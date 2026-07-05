import { createClient } from "@/lib/supabase/server";
import TeamStatsClient from "@/components/stats/TeamStatsClient";
import GlossarySheet from "@/components/GlossarySheet";
import Link from "next/link";
import type { PlayerStats } from "@/types/database";

const TEAM_ID = process.env.NEXT_PUBLIC_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

export default async function TeamPage() {
  const supabase = await createClient();

  const { data: stats, error } = await supabase
    .from("player_season_stats")
    .select("*")
    .eq("team_id", TEAM_ID)
    .order("avg", { ascending: false });

  const { data: teamData } = await supabase
    .from("teams")
    .select("name")
    .eq("id", TEAM_ID)
    .single();

  const playerStats = (stats ?? []) as PlayerStats[];

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{teamData?.name ?? "Team"}</h1>
          <p className="text-muted-foreground text-sm">Season stats</p>
        </div>
        <div className="flex items-center gap-3">
          <GlossarySheet />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
        </div>
      </div>

      <TeamStatsClient stats={playerStats} />
    </main>
  );
}
