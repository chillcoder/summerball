import { createClient } from "@/lib/supabase/server";
import { getGame, getGameLineup, getInningRuns } from "@/app/actions/games";
import { getGameAtBats } from "@/app/actions/atBats";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import GlossarySheet from "@/components/GlossarySheet";
import PastGameEditor from "@/components/recording/PastGameEditor";
import GameDetailsEditor from "@/components/recording/GameDetailsEditor";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const game = await getGame(id);
  if (!game) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: boxScore }, atBats, inningRuns] = await Promise.all([
    supabase.from("game_box_score").select("*").eq("game_id", id),
    getGameAtBats(id), // public read — feeds the line score (and the editor when signed in)
    getInningRuns(id), // real runs per inning
  ]);

  // Signed-in users can edit at-bats — even on final games ("I was safe!").
  const editLineup = user ? await getGameLineup(id) : null;

  // Line score: real runs per inning (game_innings) + hits per inning (at-bats).
  const counted = atBats.filter((ab) => !ab.is_pending);
  const runsByInning: Record<number, number> = Object.fromEntries(
    inningRuns.map((r) => [r.inning, r.runs])
  );
  const maxInning = Math.max(
    0,
    ...counted.map((ab) => ab.inning ?? 1),
    ...inningRuns.map((r) => r.inning)
  );
  const lineScore = Array.from({ length: maxInning }, (_, i) => {
    const inn = counted.filter((ab) => (ab.inning ?? 1) === i + 1);
    return {
      inning: i + 1,
      runs: runsByInning[i + 1] ?? 0,
      hits: inn.filter((ab) => ["1B", "2B", "3B", "HR"].includes(ab.outcome)).length,
    };
  });
  const totalInningRuns = lineScore.reduce((s, c) => s + c.runs, 0);
  // Show once we have real inning data (multiple innings, any runs, or live).
  const showLineScore =
    lineScore.length > 0 && (maxInning >= 2 || totalInningRuns > 0 || game.status === "live");

  const statusLabel: Record<string, string> = {
    scheduled: "Scheduled",
    live: "Live",
    final: "Final",
  };

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      {game.is_exhibition && (
        <div className="-mx-4 -mt-4 mb-4 bg-amber-600 text-black text-center text-xs font-bold py-1.5 tracking-wide">
          TEST GAME — not counted toward season stats
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm text-muted-foreground">← Home</Link>
        <GlossarySheet />
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {game.opponent ? `vs ${game.opponent}` : "Game"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date(game.played_at).toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric",
            })}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={game.status === "live" ? "default" : "secondary"}>
            {statusLabel[game.status]}
          </Badge>
          {game.final_score_us != null && game.final_score_them != null && (
            <p className="text-2xl font-bold mt-1">
              {game.final_score_us}–{game.final_score_them}
            </p>
          )}
        </div>
      </div>

      {game.status === "live" && (
        <Link href={`/record/${game.id}`}>
          <div className="mb-6 p-3 rounded-lg bg-green-900/30 border border-green-700 text-green-400 text-sm font-medium text-center">
            Resume recording →
          </div>
        </Link>
      )}

      {game.status === "final" && (
        <Link href={`/games/${game.id}/infographic`}>
          <div className="mb-6 p-3 rounded-lg bg-amber-900/20 border border-amber-700/60 text-amber-300 text-sm font-medium text-center">
            Generate infographic →
          </div>
        </Link>
      )}

      {/* Line score: real runs by inning + hits by inning */}
      {showLineScore && (
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Line score
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left py-1.5 px-3 text-muted-foreground font-medium text-xs">Inn</th>
                  {lineScore.map((c) => (
                    <th key={c.inning} className="py-1.5 px-2 text-muted-foreground font-medium text-xs">
                      {c.inning}
                    </th>
                  ))}
                  <th className="py-1.5 px-3 text-gold font-medium text-xs">R</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="text-left py-1.5 px-3 text-muted-foreground text-xs">Runs</td>
                  {lineScore.map((c) => (
                    <td key={c.inning} className="py-1.5 px-2 font-mono font-semibold">
                      {c.runs}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 font-mono font-bold text-gold">{totalInningRuns}</td>
                </tr>
                <tr>
                  <td className="text-left py-1.5 px-3 text-muted-foreground text-xs">Hits</td>
                  {lineScore.map((c) => (
                    <td key={c.inning} className="py-1.5 px-2 font-mono text-muted-foreground">
                      {c.hits}
                    </td>
                  ))}
                  <td className="py-1.5 px-3 font-mono font-semibold text-gold">
                    {lineScore.reduce((s, c) => s + c.hits, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Box score */}
      {boxScore && boxScore.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">#</th>
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Player</th>
                <th className="text-center py-2 px-2 text-muted-foreground font-medium text-xs">AB</th>
                <th className="text-center py-2 px-2 text-muted-foreground font-medium text-xs">H</th>
                <th className="text-center py-2 px-2 text-muted-foreground font-medium text-xs">HR</th>
                <th className="text-center py-2 px-2 text-muted-foreground font-medium text-xs">RBI</th>
                <th className="text-center py-2 px-2 text-muted-foreground font-medium text-xs">BB</th>
              </tr>
            </thead>
            <tbody>
              {boxScore.map((row: {
                player_id: string;
                player_name: string;
                batting_position: number | null;
                ab: number;
                hits: number;
                home_runs: number;
                rbi: number;
                walks: number;
              }) => (
                <tr key={row.player_id} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground text-xs">{row.batting_position ?? "–"}</td>
                  <td className="py-2 pr-4">
                    <Link href={`/player/${row.player_id}`} className="hover:text-white transition-colors">
                      {row.player_name}
                    </Link>
                  </td>
                  <td className="text-center py-2 px-2 text-muted-foreground">{row.ab}</td>
                  <td className="text-center py-2 px-2 font-semibold">{row.hits}</td>
                  <td className="text-center py-2 px-2">{row.home_runs || "–"}</td>
                  <td className="text-center py-2 px-2">{row.rbi || "–"}</td>
                  <td className="text-center py-2 px-2 text-muted-foreground">{row.walks || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {boxScore?.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No stats recorded yet</p>
      )}

      {user && (
        <>
          <GameDetailsEditor game={game} />
          {editLineup && atBats.length > 0 && (
            <PastGameEditor gameId={id} initialAtBats={atBats} lineup={editLineup} />
          )}
        </>
      )}
    </main>
  );
}
