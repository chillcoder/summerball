"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Player } from "@/types/database";

const TEAM_ID = process.env.NEXT_PUBLIC_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

export async function getPlayers(): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", TEAM_ID)
    .order("name");

  if (error) throw new Error(error.message);
  return data as Player[];
}

export async function getActivePlayers(): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", TEAM_ID)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data as Player[];
}

// Regular roster only (active, non-guest) — the default list for a new lineup,
// so one-off guests don't pile up in every future game.
export async function getRosterPlayers(): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", TEAM_ID)
    .eq("is_active", true)
    .eq("is_guest", false)
    .order("name");

  if (error) throw new Error(error.message);
  return data as Player[];
}

// Persist a one-off guest immediately so the lineup/at-bat rows that reference it
// satisfy the players FK. Returns the real row (with its DB id).
export async function addGuestPlayer(name: string): Promise<Player> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .insert({ team_id: TEAM_ID, name: trimmed, is_active: true, is_guest: true })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Player;
}

export async function addPlayer(formData: FormData): Promise<Player> {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  const isGuest = formData.get("is_guest") === "true";

  if (!name) throw new Error("Name is required");

  const { data, error } = await supabase
    .from("players")
    .insert({
      team_id: TEAM_ID,
      name,
      is_active: true,
      is_guest: isGuest,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/roster");
  return data as Player;
}

export async function renamePlayer(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");
  return updatePlayer(id, { name: trimmed });
}

export async function updatePlayer(
  id: string,
  updates: Partial<Pick<Player, "name" | "is_active" | "is_guest">>
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update(updates)
    .eq("id", id)
    .eq("team_id", TEAM_ID);

  if (error) throw new Error(error.message);
  revalidatePath("/roster");
}

export async function togglePlayerActive(id: string, isActive: boolean) {
  return updatePlayer(id, { is_active: isActive });
}
