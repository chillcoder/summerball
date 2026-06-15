import { getGame, getGameLineup } from "@/app/actions/games";
import { getActivePlayers } from "@/app/actions/roster";
import LineupClient from "@/components/recording/LineupClient";
import { notFound } from "next/navigation";

export default async function LineupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [game, activePlayers] = await Promise.all([
    getGame(id),
    getActivePlayers(),
  ]);

  if (!game) notFound();

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Set Lineup</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Drag to reorder · tap to mark DNP
      </p>
      <LineupClient game={game} players={activePlayers} />
    </main>
  );
}
