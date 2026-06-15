import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatStat } from "@/lib/stats/compute";
import type { PlayerStats } from "@/types/database";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: statsData }, { data: gameHistory }, { data: player }] = await Promise.all([
    supabase
      .from("player_season_stats")
      .select("*")
      .eq("player_id", id)
      .single(),
    supabase
      .from("player_game_stats")
      .select("*")
      .eq("player_id", id)
      .order("played_at", { ascending: false })
      .limit(15),
    supabase
      .from("players")
      .select("name")
      .eq("id", id)
      .single(),
  ]);

  if (!player) notFound();

  const stats = statsData as PlayerStats | null;

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <Link href="/team" className="text-sm text-muted-foreground mb-4 block">← Season stats</Link>

      <h1 className="text-3xl font-bold mb-1">{player.name}</h1>

      {!stats || stats.ab === 0 ? (
        <p className="text-muted-foreground mt-6">No stats yet this season.</p>
      ) : (
        <>
          {/* Big four stats */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            {(["avg", "obp", "slg", "ops"] as const).map((key) => (
              <div key={key} className="rounded-lg bg-zinc-900 border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{key}</p>
                <p className="text-xl font-bold font-mono mt-1">
                  {formatStat(stats[key], key)}
                </p>
              </div>
            ))}
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-5 gap-2 mt-3">
            {[
              { label: "G", value: stats.games_played },
              { label: "AB", value: stats.ab },
              { label: "H", value: stats.hits },
              { label: "HR", value: stats.home_runs },
              { label: "RBI", value: stats.rbi },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>

          {/* Hits breakdown */}
          <div className="mt-4 rounded-lg bg-zinc-900 border border-border p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Hit breakdown</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "1B", value: stats.singles },
                { label: "2B", value: stats.doubles },
                { label: "3B", value: stats.triples },
                { label: "HR", value: stats.home_runs },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold text-lg">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Game-by-game */}
          {gameHistory && gameHistory.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Game history</p>
              <div className="space-y-2">
                {gameHistory.map((g: { game_id: string; played_at: string; opponent: string | null; hits: number; ab: number; avg: number; home_runs: number; rbi: number }) => (
                  <Link
                    key={g.game_id}
                    href={`/games/${g.game_id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-zinc-600 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {g.opponent ? `vs ${g.opponent}` : "Game"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(g.played_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold">
                        {g.hits}-{g.ab}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatStat(g.avg, "avg")}
                        {g.home_runs > 0 && ` · ${g.home_runs} HR`}
                        {g.rbi > 0 && ` · ${g.rbi} RBI`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
