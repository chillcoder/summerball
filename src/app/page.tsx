import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getGames } from "@/app/actions/games";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import DeleteGameButton from "@/components/recording/DeleteGameButton";

export default async function Home() {
  const [games, supabase] = await Promise.all([
    getGames().catch(() => []),
    createClient(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const liveGame = games.find((g) => g.status === "live");
  const scheduledGames = games.filter((g) => g.status === "scheduled");
  const recentGames = games
    .filter((g) => g.status === "final" && !g.is_exhibition)
    .slice(0, 3);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Summer Ball</h1>
        <p className="text-muted-foreground mt-1">Softball stats tracker</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {liveGame && (
          <div className="flex gap-2">
            <Link href={`/record/${liveGame.id}`} className="flex-1 min-w-0">
              <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-cream font-bold">
                Resume Live Game
                {liveGame.opponent && ` vs ${liveGame.opponent}`}
                <Badge variant="outline" className="ml-2 border-green-400 text-green-300">LIVE</Badge>
              </Button>
            </Link>
            {user && (
              <DeleteGameButton
                gameId={liveGame.id}
                label="Delete"
                confirmText="Delete this live game and every at-bat recorded so far? This can't be undone."
                className="shrink-0"
                size="lg"
              />
            )}
          </div>
        )}

        {user &&
          scheduledGames.map((game) => (
            <div key={game.id} className="flex gap-2">
              <Link href={`/games/${game.id}/lineup`} className="flex-1 min-w-0">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-amber-700 text-amber-300 hover:bg-amber-900/20"
                >
                  Finish setup{game.opponent ? ` vs ${game.opponent}` : ""}
                  {game.is_exhibition && (
                    <Badge variant="outline" className="ml-2 border-amber-500 text-amber-300">TEST</Badge>
                  )}
                </Button>
              </Link>
              <DeleteGameButton
                gameId={game.id}
                label="Delete"
                confirmText="Discard this unstarted game and its lineup? This can't be undone."
                className="shrink-0"
                size="lg"
              />
            </div>
          ))}

        {user && (
          <Link href="/games/new">
            <Button size="lg" className="w-full font-semibold">
              New Game
            </Button>
          </Link>
        )}

        {user && (
          <Link href="/games/new?test=1">
            <Button size="lg" variant="ghost" className="w-full text-muted-foreground">
              New Test Game
            </Button>
          </Link>
        )}

        <Link href="/team">
          <Button size="lg" variant="outline" className="w-full">
            Season Stats
          </Button>
        </Link>

        {user && (
          <Link href="/roster">
            <Button size="lg" variant="outline" className="w-full">
              Manage Roster
            </Button>
          </Link>
        )}

        {!user && (
          <Link href="/login">
            <Button size="lg" variant="ghost" className="w-full text-muted-foreground">
              Sign in to record
            </Button>
          </Link>
        )}
      </div>

      {recentGames.length > 0 && (
        <div className="w-full max-w-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Recent Games</p>
          <div className="flex flex-col gap-2">
            {recentGames.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-bk-teal/60 transition-colors">
                <span className="text-sm font-medium">
                  {game.opponent ? `vs ${game.opponent}` : "No opponent"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(game.played_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {game.final_score_us != null && game.final_score_them != null
                    ? ` · ${game.final_score_us}–${game.final_score_them}`
                    : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
