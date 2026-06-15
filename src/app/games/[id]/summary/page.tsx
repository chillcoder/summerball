import { createClient } from "@/lib/supabase/server";
import { getGame } from "@/app/actions/games";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function GameSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const game = await getGame(id);
  if (!game) notFound();

  const { data: boxScore } = await supabase
    .from("game_box_score")
    .select("*")
    .eq("game_id", id);

  const totalHits = boxScore?.reduce((s: number, r: { hits: number }) => s + (r.hits ?? 0), 0) ?? 0;
  const totalRbi = boxScore?.reduce((s: number, r: { rbi: number }) => s + (r.rbi ?? 0), 0) ?? 0;
  const totalHr = boxScore?.reduce((s: number, r: { home_runs: number }) => s + (r.home_runs ?? 0), 0) ?? 0;

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto flex flex-col">
      <h1 className="text-2xl font-bold mb-1">Game Summary</h1>
      <p className="text-muted-foreground text-sm mb-6">
        {game.opponent ? `vs ${game.opponent}` : "Game"} ·{" "}
        {new Date(game.played_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        {game.final_score_us != null && game.final_score_them != null
          ? ` · ${game.final_score_us}–${game.final_score_them}`
          : ""}
      </p>

      {/* Team totals */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Hits", value: totalHits },
          { label: "RBI", value: totalRbi },
          { label: "HR", value: totalHr },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-zinc-900 border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 mt-auto">
        <Link href={`/games/${id}/infographic`}>
          <Button className="w-full font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950">
            Generate Infographic
          </Button>
        </Link>
        <Link href={`/games/${id}`}>
          <Button variant="outline" className="w-full">View Full Box Score</Button>
        </Link>
        <Link href="/team">
          <Button variant="outline" className="w-full">Season Stats</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost" className="w-full text-muted-foreground">Home</Button>
        </Link>
      </div>
    </main>
  );
}
