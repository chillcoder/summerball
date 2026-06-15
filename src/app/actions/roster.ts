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

export async function addPlayer(formData: FormData) {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  const isGuest = formData.get("is_guest") === "true";

  if (!name) throw new Error("Name is required");

  const { error } = await supabase.from("players").insert({
    team_id: TEAM_ID,
    name,
    is_active: true,
    is_guest: isGuest,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/roster");
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
