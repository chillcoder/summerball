import { createClient } from "@/lib/supabase/server";
import { getGame } from "@/app/actions/games";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { OUTCOME_LABELS } from "@/types/database";
import type { AtBat } from "@/types/database";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const game = await getGame(id);
  if (!game) notFound();

  const { data: boxScore } = await supabase
    .from("game_box_score")
    .select("*")
    .eq("game_id", id);

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
      <Link href="/" className="text-sm text-muted-foreground mb-4 block">← Home</Link>

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
    </main>
  );
}
