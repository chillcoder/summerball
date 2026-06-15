"use client";

import { useState, useTransition } from "react";
import { addPlayer, togglePlayerActive } from "@/app/actions/roster";
import type { Player } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function RosterClient({ initialPlayers }: { initialPlayers: Player[] }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("is_guest", "false");

    startTransition(async () => {
      try {
        await addPlayer(formData);
        setName("");
        setShowAdd(false);
        toast.success(`${name.trim()} added to roster`);
        // Optimistic: refetch would happen via revalidatePath, but for instant feedback:
        setPlayers((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            team_id: "",
            name: name.trim(),
            is_active: true,
            is_guest: false,
            joined_at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        toast.error("Failed to add player");
      }
    });
  }

  function handleToggle(player: Player) {
    startTransition(async () => {
      try {
        await togglePlayerActive(player.id, !player.is_active);
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === player.id ? { ...p, is_active: !p.is_active } : p
          )
        );
      } catch {
        toast.error("Failed to update player");
      }
    });
  }

  const active = players.filter((p) => p.is_active && !p.is_guest);
  const guests = players.filter((p) => p.is_active && p.is_guest);
  const inactive = players.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      <Button
        onClick={() => setShowAdd(!showAdd)}
        variant="outline"
        className="w-full"
      >
        + Add Player
      </Button>

      {showAdd && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
          <Button type="submit" disabled={isPending}>
            Add
          </Button>
        </form>
      )}

      <PlayerSection title="Active" players={active} onToggle={handleToggle} />
      {guests.length > 0 && (
        <PlayerSection title="Guests" players={guests} onToggle={handleToggle} showGuestBadge />
      )}
      {inactive.length > 0 && (
        <PlayerSection title="Inactive" players={inactive} onToggle={handleToggle} muted />
      )}
    </div>
  );
}

function PlayerSection({
  title,
  players,
  onToggle,
  showGuestBadge = false,
  muted = false,
}: {
  title: string;
  players: Player[];
  onToggle: (p: Player) => void;
  showGuestBadge?: boolean;
  muted?: boolean;
}) {
  if (players.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center justify-between p-3 rounded-lg border border-border ${muted ? "opacity-50" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{player.name}</span>
              {showGuestBadge && (
                <Badge variant="secondary" className="text-xs">Guest</Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggle(player)}
              className="text-xs text-muted-foreground"
            >
              {player.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
