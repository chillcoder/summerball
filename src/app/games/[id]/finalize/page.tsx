import { getGame, getGameLineup } from "@/app/actions/games";
import { getGameAtBats } from "@/app/actions/atBats";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import FinalizeClient from "@/components/recording/FinalizeClient";

export default async function FinalizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/games/${id}/finalize`);

  const [game, lineup, atBats] = await Promise.all([
    getGame(id),
    getGameLineup(id),
    getGameAtBats(id),
  ]);

  if (!game) notFound();

  const playerNames = Object.fromEntries(
    lineup.map((l) => [l.player_id, l.player.name])
  );

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Review &amp; Finalize</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Add RBIs, fix any outcomes, then calculate stats. This rolls the game into season totals.
      </p>
      <FinalizeClient
        game={game}
        initialAtBats={atBats}
        playerNames={playerNames}
      />
    </main>
  );
}
