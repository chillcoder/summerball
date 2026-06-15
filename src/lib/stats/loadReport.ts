import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildGameReport, type GameReport } from "./gameReport";
import type { AtBat } from "@/types/database";

const SEASON_LABEL = "Summer Ball 2026";

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Load everything needed to render a game's infographic / recap from the DB
 * and compute the full report with correct baseball rules. Returns null if the
 * game doesn't exist.
 */
export async function loadGameReport(gameId: string): Promise<GameReport | null> {
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*, teams(name)")
    .eq("id", gameId)
    .single();

  if (!game) return null;

  const { data: atBats } = await supabase
    .from("at_bats")
    .select("*")
    .eq("game_id", gameId)
    .order("sequence_in_game");

  const abs = (atBats ?? []) as AtBat[];
  const playerIds = [...new Set(abs.map((a) => a.player_id))];

  const { data: players } = await supabase
    .from("players")
    .select("id, name")
    .in("id", playerIds.length > 0 ? playerIds : ["00000000-0000-0000-0000-000000000000"]);

  const teamName =
    (game.teams as { name?: string } | null)?.name ?? "Team";

  return buildGameReport(players ?? [], abs, {
    teamName,
    seasonLabel: SEASON_LABEL,
    opponent: game.opponent,
    dateLabel: formatDate(game.played_at),
    finalScoreUs: game.final_score_us,
    finalScoreThem: game.final_score_them,
  });
}

export async function getStoredRecap(
  gameId: string
): Promise<string[] | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("recap_bullets")
    .eq("id", gameId)
    .single();
  const bullets = (data as { recap_bullets?: string[] } | null)?.recap_bullets;
  return Array.isArray(bullets) && bullets.length > 0 ? bullets : null;
}
