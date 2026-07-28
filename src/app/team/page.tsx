import { createClient } from "@/lib/supabase/server";
import TeamStatsClient from "@/components/stats/TeamStatsClient";
import AskStatsBox from "@/components/stats/AskStatsBox";
import GlossarySheet from "@/components/GlossarySheet";
import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";
import type { PlayerStats } from "@/types/database";
import { computeStreaks, type StreakInfo } from "@/lib/stats/streaks";

const TEAM_ID = process.env.NEXT_PUBLIC_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: stats }, { data: teamData }, { data: gameLines }] = await Promise.all([
    supabase
      .from("player_season_stats")
      .select("*")
      .eq("team_id", TEAM_ID)
      .order("avg", { ascending: false }),
    supabase.from("teams").select("name").eq("id", TEAM_ID).single(),
    // Single-team app: every row in the per-game view is ours.
    supabase
      .from("player_game_stats")
      .select("player_id, played_at, ab, hits")
      .order("played_at", { ascending: false }),
  ]);

  const playerStats = (stats ?? []) as PlayerStats[];

  // Hot/cold + hit-streak badges from recent form.
  const linesByPlayer: Record<string, { hits: number; ab: number }[]> = {};
  for (const row of (gameLines ?? []) as { player_id: string; ab: number; hits: number }[]) {
    (linesByPlayer[row.player_id] ??= []).push({ hits: row.hits, ab: row.ab });
  }
  const streaksByPlayer: Record<string, StreakInfo> = {};
  for (const p of playerStats) {
    streaksByPlayer[p.player_id] = computeStreaks(linesByPlayer[p.player_id] ?? [], p.avg);
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={40} className="rounded-lg" />
          <div>
            <h1 className="text-2xl font-bold">{teamData?.name ?? "Team"}</h1>
            <p className="text-muted-foreground text-sm">Season stats</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <GlossarySheet />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
        </div>
      </div>

      <TeamStatsClient stats={playerStats} streaksByPlayer={streaksByPlayer} />

      {/* LLM Q&A costs money per call — signed-in teammates only. */}
      {user && <AskStatsBox />}
    </main>
  );
}
