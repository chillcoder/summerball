import { getGame, getGameLineup, getSeasonStatsMap, getInningRuns } from "@/app/actions/games";
import { getGameAtBats } from "@/app/actions/atBats";
import RecordingScreen from "@/components/recording/RecordingScreen";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RecordPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/record/${gameId}`);
  }

  const [game, lineup, atBats, statsByPlayer, inningRuns] = await Promise.all([
    getGame(gameId),
    getGameLineup(gameId),
    getGameAtBats(gameId),
    getSeasonStatsMap(),
    getInningRuns(gameId),
  ]);

  if (!game) notFound();
  if (game.status === "final") redirect(`/games/${gameId}/summary`);

  const playingLineup = lineup
    .filter((e) => e.status === "played")
    .sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99));

  return (
    <RecordingScreen
      game={game}
      lineup={playingLineup}
      initialAtBats={atBats}
      userId={user.id}
      statsByPlayer={statsByPlayer}
      initialInningRuns={inningRuns}
    />
  );
}
