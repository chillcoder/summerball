import {
  getGame,
  getGameLineup,
  getSeasonStatsMap,
  getSeasonOutcomeCounts,
} from "@/app/actions/games";
import { getRosterPlayers } from "@/app/actions/roster";
import LineupClient from "@/components/recording/LineupClient";
import DeleteGameButton from "@/components/recording/DeleteGameButton";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function LineupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [game, rosterPlayers, savedLineup, statsByPlayer, outcomeCounts] = await Promise.all([
    getGame(id),
    getRosterPlayers(),
    getGameLineup(id),
    getSeasonStatsMap(),
    getSeasonOutcomeCounts(),
  ]);

  if (!game) notFound();

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <Link
        href={game.status === "live" ? `/record/${game.id}` : "/"}
        className="text-sm text-muted-foreground mb-4 block"
      >
        ← {game.status === "live" ? "Back to game" : "Home"}
      </Link>
      <h1 className="text-2xl font-bold mb-1">
        {game.status === "live" ? "Edit Lineup" : "Set Lineup"}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        Drag to reorder · tap to mark DNP · ✨ suggest from season stats
      </p>
      <LineupClient
        game={game}
        players={rosterPlayers}
        savedLineup={savedLineup}
        statsByPlayer={statsByPlayer}
        outcomeCounts={outcomeCounts}
      />

      {game.status !== "final" && (
        <div className="mt-8 pt-4 border-t border-border">
          <DeleteGameButton
            gameId={game.id}
            label={game.status === "live" ? "Delete this game" : "Discard this game"}
            confirmText={
              game.status === "live"
                ? "Delete this live game and every at-bat recorded so far? This can't be undone."
                : "Discard this game and its lineup? This can't be undone."
            }
          />
        </div>
      )}
    </main>
  );
}
