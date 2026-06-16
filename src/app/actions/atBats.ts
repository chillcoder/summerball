"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AtBat, AtBatOutcome } from "@/types/database";

export async function recordAtBat(params: {
  // Client-supplied id makes offline create→update→delete stable across the
  // sync queue, and lets a replayed insert no-op instead of duplicating.
  id?: string;
  gameId: string;
  playerId: string;
  outcome: AtBatOutcome;
  sequenceInGame: number;
  rbis?: number;
  runsScored?: number;
  isPending?: boolean;
  wasSelfAb?: boolean;
}): Promise<AtBat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row = {
    ...(params.id ? { id: params.id } : {}),
    game_id: params.gameId,
    player_id: params.playerId,
    outcome: params.outcome,
    sequence_in_game: params.sequenceInGame,
    rbis: params.rbis ?? 0,
    runs_scored: params.runsScored ?? 0,
    recorded_by_user_id: user?.id ?? null,
    is_pending: params.isPending ?? false,
    was_self_ab: params.wasSelfAb ?? false,
  };

  // Upsert on the primary key: a replayed insert (same id) is a no-op rather
  // than a duplicate or a unique-violation error.
  const { data, error } = await supabase
    .from("at_bats")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);

  // On a no-op conflict, Supabase returns no row — reconstruct from inputs so
  // the caller always gets a complete AtBat.
  return (
    (data as AtBat | null) ?? {
      id: params.id!,
      game_id: params.gameId,
      player_id: params.playerId,
      sequence_in_game: params.sequenceInGame,
      outcome: params.outcome,
      rbis: params.rbis ?? 0,
      runs_scored: params.runsScored ?? 0,
      recorded_by_user_id: user?.id ?? null,
      recorded_at: new Date().toISOString(),
      is_pending: params.isPending ?? false,
      was_self_ab: params.wasSelfAb ?? false,
    }
  );
}

export async function deleteAtBat(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("at_bats").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateAtBat(
  id: string,
  updates: Partial<Pick<AtBat, "outcome" | "rbis" | "runs_scored" | "is_pending">>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("at_bats")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function getGameAtBats(gameId: string): Promise<AtBat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("at_bats")
    .select("*")
    .eq("game_id", gameId)
    .order("sequence_in_game");

  if (error) throw new Error(error.message);
  return data as AtBat[];
}

export async function getPlayerAtBats(playerId: string): Promise<AtBat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("at_bats")
    .select("*")
    .eq("player_id", playerId)
    .order("recorded_at");

  if (error) throw new Error(error.message);
  return data as AtBat[];
}

export async function getPendingAtBats(gameId: string): Promise<AtBat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("at_bats")
    .select("*")
    .eq("game_id", gameId)
    .eq("is_pending", true);

  if (error) throw new Error(error.message);
  return data as AtBat[];
}
