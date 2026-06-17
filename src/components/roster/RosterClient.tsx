"use client";

import { useState, useTransition } from "react";
import { addPlayer, renamePlayer, togglePlayerActive } from "@/app/actions/roster";
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
    const trimmed = name.trim();
    if (!trimmed) return;
    const formData = new FormData();
    formData.set("name", trimmed);
    formData.set("is_guest", "false");

    startTransition(async () => {
      try {
        const created = await addPlayer(formData);
        setPlayers((prev) => [...prev, created]);
        setName("");
        setShowAdd(false);
        toast.success(`${created.name} added to roster`);
      } catch {
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

  function handleRename(player: Player, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === player.name) return;
    // Optimistic
    setPlayers((prev) =>
      prev.map((p) => (p.id === player.id ? { ...p, name: trimmed } : p))
    );
    startTransition(async () => {
      try {
        await renamePlayer(player.id, trimmed);
        toast.success(`Renamed to ${trimmed}`);
      } catch {
        toast.error("Failed to rename");
        setPlayers((prev) =>
          prev.map((p) => (p.id === player.id ? { ...p, name: player.name } : p))
        );
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

      <PlayerSection title="Active" players={active} onToggle={handleToggle} onRename={handleRename} />
      {guests.length > 0 && (
        <PlayerSection title="Guests" players={guests} onToggle={handleToggle} onRename={handleRename} showGuestBadge />
      )}
      {inactive.length > 0 && (
        <PlayerSection title="Inactive" players={inactive} onToggle={handleToggle} onRename={handleRename} muted />
      )}
    </div>
  );
}

function PlayerSection({
  title,
  players,
  onToggle,
  onRename,
  showGuestBadge = false,
  muted = false,
}: {
  title: string;
  players: Player[];
  onToggle: (p: Player) => void;
  onRename: (p: Player, newName: string) => void;
  showGuestBadge?: boolean;
  muted?: boolean;
}) {
  if (players.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1">
        {players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            onToggle={onToggle}
            onRename={onRename}
            showGuestBadge={showGuestBadge}
            muted={muted}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  onToggle,
  onRename,
  showGuestBadge,
  muted,
}: {
  player: Player;
  onToggle: (p: Player) => void;
  onRename: (p: Player, newName: string) => void;
  showGuestBadge?: boolean;
  muted?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player.name);

  function commit() {
    setEditing(false);
    onRename(player, draft);
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 p-3 rounded-lg border border-border ${muted ? "opacity-50" : ""}`}
    >
      {editing ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(player.name);
              setEditing(false);
            }
          }}
          onBlur={commit}
          className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-600 text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-500"
        />
      ) : (
        <button
          className="flex items-center gap-2 flex-1 text-left"
          onClick={() => {
            setDraft(player.name);
            setEditing(true);
          }}
          aria-label={`Rename ${player.name}`}
        >
          <span className="font-medium">{player.name}</span>
          {showGuestBadge && <Badge variant="secondary" className="text-xs">Guest</Badge>}
          <span className="text-xs text-muted-foreground">✎</span>
        </button>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => onToggle(player)}
        className="text-xs text-muted-foreground shrink-0"
      >
        {player.is_active ? "Deactivate" : "Reactivate"}
      </Button>
    </div>
  );
}
