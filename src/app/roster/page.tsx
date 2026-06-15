import { getPlayers } from "@/app/actions/roster";
import RosterClient from "@/components/roster/RosterClient";

export default async function RosterPage() {
  const players = await getPlayers();

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Roster</h1>
          <p className="text-muted-foreground text-sm">{players.filter(p => p.is_active).length} active players</p>
        </div>
      </div>
      <RosterClient initialPlayers={players} />
    </main>
  );
}
