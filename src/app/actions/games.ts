"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AtBatOutcome, Game, GameLineup, LineupMode, Player, PlayerStats } from "@/types/database";
import { loadGameReport } from "@/lib/stats/loadReport";
import { generateRecap } from "@/lib/ai/recap";

const TEAM_ID = process.env.NEXT_PUBLIC_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("team_id", TEAM_ID)
    .order("played_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Game[];
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Game;
}

export async function createGame(formData: FormData) {
  const supabase = await createClient();
  const opponent = (formData.get("opponent") as string)?.trim() || null;
  const playedAt = formData.get("played_at") as string;
  const lineupMode = (formData.get("lineup_mode") as LineupMode) ?? "continuous";
  const isExhibition = formData.get("is_exhibition") === "true";

  const { data: game, error } = await supabase
    .from("games")
    .insert({
      team_id: TEAM_ID,
      opponent,
      played_at: playedAt || new Date().toISOString().split("T")[0],
      lineup_mode: lineupMode,
      status: "scheduled",
      is_exhibition: isExhibition,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Return the id and let the client navigate, so a failure surfaces as a toast
  // instead of an unhandled error in the transition.
  return { gameId: game.id as string };
}

export async function saveLineup(
  gameId: string,
  lineup: { playerId: string; battingPosition: number; status: string }[]
) {
  const supabase = await createClient();

  // Upsert lineup entries
  const { error } = await supabase.from("game_lineups").upsert(
    lineup.map((entry) => ({
      game_id: gameId,
      player_id: entry.playerId,
      batting_position: entry.battingPosition,
      status: entry.status,
    })),
    { onConflict: "game_id,player_id" }
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/games/${gameId}`);
}

export async function startGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({ status: "live" })
    .eq("id", gameId);

  if (error) throw new Error(error.message);
  redirect(`/record/${gameId}`);
}

// Persist the current inning so a mid-game reload resumes where we were.
export async function setGameInning(gameId: string, inning: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({ current_inning: inning })
    .eq("id", gameId);

  if (error) throw new Error(error.message);
}

export async function endGame(
  gameId: string,
  finalScoreUs?: number,
  finalScoreThem?: number,
  notes?: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("games")
    .update({
      status: "final",
      final_score_us: finalScoreUs ?? null,
      final_score_them: finalScoreThem ?? null,
      notes: notes ?? null,
    })
    .eq("id", gameId);

  if (error) throw new Error(error.message);
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}/summary`);
}

/**
 * Finalize a game: write per-at-bat RBIs, set the score, mark the game `final`
 * (which rolls it into season stats), then generate + store the AI recap.
 */
export async function finalizeGame(params: {
  gameId: string;
  rbis: Record<string, number>;
  scoreUs?: number | null;
  scoreThem?: number | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Persist RBI edits
  await Promise.all(
    Object.entries(params.rbis).map(([atBatId, rbi]) =>
      supabase.from("at_bats").update({ rbis: rbi }).eq("id", atBatId)
    )
  );

  // 2. Mark final + score (this is what makes stats count)
  const { error } = await supabase
    .from("games")
    .update({
      status: "final",
      final_score_us: params.scoreUs ?? null,
      final_score_them: params.scoreThem ?? null,
      notes: params.notes ?? null,
    })
    .eq("id", params.gameId);

  if (error) throw new Error(error.message);

  // 3. Compute the report (now that the game is final) and generate the recap.
  const report = await loadGameReport(params.gameId);
  if (report) {
    const { bullets, source } = await generateRecap(report, user?.id ?? "system");
    // Store it — tolerant of the recap columns not existing yet.
    await supabase
      .from("games")
      .update({
        recap_bullets: bullets,
        recap_source: source,
        recap_generated_at: new Date().toISOString(),
      })
      .eq("id", params.gameId);
  }

  revalidatePath(`/games/${params.gameId}`);
  revalidatePath("/team");
  redirect(`/games/${params.gameId}/summary`);
}

export async function regenerateRecap(gameId: string): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const report = await loadGameReport(gameId);
  if (!report) throw new Error("Game not found");
  const { bullets, source } = await generateRecap(report, user?.id ?? "system");
  await supabase
    .from("games")
    .update({
      recap_bullets: bullets,
      recap_source: source,
      recap_generated_at: new Date().toISOString(),
    })
    .eq("id", gameId);
  revalidatePath(`/games/${gameId}/infographic`);
  return bullets;
}

// Delete a game (at-bats + lineup cascade). Allowed for test games and any
// not-yet-final game (scheduled lineups created by mistake, abandoned live
// games). A finalized real game is protected so season stats can't be wiped.
export async function deleteGame(gameId: string) {
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("status, is_exhibition")
    .eq("id", gameId)
    .single();

  if (!game) throw new Error("Game not found");
  if (game.status === "final" && !game.is_exhibition) {
    throw new Error("Finalized games can't be deleted");
  }

  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/team");
  redirect("/");
}

export async function getGameLineup(gameId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_lineups")
    .select("*, player:players(*)")
    .eq("game_id", gameId)
    .order("batting_position");

  if (error) throw new Error(error.message);
  return data as (GameLineup & { player: Player })[];
}

// Raw per-player outcome counts across the season (final, non-exhibition games).
// Feeds the Monte Carlo lineup optimizer's outcome distributions.
export async function getSeasonOutcomeCounts(): Promise<
  Record<string, Partial<Record<AtBatOutcome, number>>>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("at_bats")
    .select("player_id, outcome, games!inner(status, is_exhibition, team_id)")
    .eq("is_pending", false)
    .eq("games.status", "final")
    .eq("games.is_exhibition", false)
    .eq("games.team_id", TEAM_ID);

  if (error) return {};
  const counts: Record<string, Partial<Record<AtBatOutcome, number>>> = {};
  for (const row of (data ?? []) as unknown as { player_id: string; outcome: AtBatOutcome }[]) {
    const c = (counts[row.player_id] ??= {});
    c[row.outcome] = (c[row.outcome] ?? 0) + 1;
  }
  return counts;
}

// Season stats keyed by player_id, for the rule-based lineup recommendation.
// Tolerant: returns {} if the view is empty or unavailable (e.g. no games yet).
export async function getSeasonStatsMap(): Promise<Record<string, PlayerStats>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_season_stats")
    .select("*")
    .eq("team_id", TEAM_ID);

  if (error) return {};
  const map: Record<string, PlayerStats> = {};
  for (const row of (data ?? []) as PlayerStats[]) map[row.player_id] = row;
  return map;
}
