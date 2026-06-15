"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveLineup, startGame } from "@/app/actions/games";
import type { Game, Player } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface LineupEntry {
  player: Player;
  isDnp: boolean;
}

function SortablePlayer({
  entry,
  position,
  onToggleDnp,
}: {
  entry: LineupEntry;
  position: number;
  onToggleDnp: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.player.id, disabled: entry.isDnp });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        entry.isDnp
          ? "border-border opacity-40 bg-zinc-900/50"
          : "border-border bg-zinc-900 hover:border-zinc-600"
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none text-muted-foreground cursor-grab active:cursor-grabbing p-1"
        disabled={entry.isDnp}
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </button>

      {/* Position number */}
      <span className="text-sm text-muted-foreground w-5 text-center font-mono">
        {entry.isDnp ? "–" : position}
      </span>

      {/* Name */}
      <span className="flex-1 font-medium">{entry.player.name}</span>

      {/* DNP toggle */}
      <button
        onClick={() => onToggleDnp(entry.player.id)}
        className={`text-xs px-2 py-1 rounded transition-colors ${
          entry.isDnp
            ? "text-red-400 border border-red-800 hover:bg-red-900/30"
            : "text-muted-foreground border border-transparent hover:border-border"
        }`}
      >
        {entry.isDnp ? "DNP" : "Playing"}
      </button>
    </div>
  );
}

export default function LineupClient({
  game,
  players,
}: {
  game: Game;
  players: Player[];
}) {
  const [lineup, setLineup] = useState<LineupEntry[]>(
    players.map((p) => ({ player: p, isDnp: false }))
  );
  const [guestName, setGuestName] = useState("");
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLineup((items) => {
      const oldIndex = items.findIndex((i) => i.player.id === active.id);
      const newIndex = items.findIndex((i) => i.player.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function toggleDnp(playerId: string) {
    setLineup((items) =>
      items.map((item) =>
        item.player.id === playerId
          ? { ...item, isDnp: !item.isDnp }
          : item
      )
    );
  }

  function addGuest() {
    if (!guestName.trim()) return;
    const guest: Player = {
      id: crypto.randomUUID(),
      team_id: game.team_id,
      name: guestName.trim(),
      is_active: true,
      is_guest: true,
      joined_at: new Date().toISOString(),
    };
    setLineup((prev) => [...prev, { player: guest, isDnp: false }]);
    setGuestName("");
  }

  function handleStart() {
    const playing = lineup.filter((e) => !e.isDnp);
    if (playing.length === 0) {
      toast.error("You need at least one player");
      return;
    }

    startTransition(async () => {
      try {
        let position = 1;
        const lineupData = lineup.map((entry) => ({
          playerId: entry.player.id,
          battingPosition: entry.isDnp ? 0 : position++,
          status: entry.isDnp ? "dnp" : "played",
        }));
        await saveLineup(game.id, lineupData);
        await startGame(game.id);
      } catch (err) {
        toast.error("Failed to start game");
      }
    });
  }

  // Only show non-DNP for sortable context
  const playingIds = lineup.filter((e) => !e.isDnp).map((e) => e.player.id);
  let playingPosition = 0;

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={lineup.map((e) => e.player.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {lineup.map((entry) => {
              if (!entry.isDnp) playingPosition++;
              return (
                <SortablePlayer
                  key={entry.player.id}
                  entry={entry}
                  position={entry.isDnp ? 0 : playingPosition}
                  onToggleDnp={toggleDnp}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add guest */}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          placeholder="Add guest player..."
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addGuest()}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-zinc-500 text-sm"
        />
        <Button variant="outline" size="sm" onClick={addGuest} disabled={!guestName.trim()}>
          Add
        </Button>
      </div>

      <div className="pt-2">
        <p className="text-xs text-muted-foreground mb-3 text-center">
          {lineup.filter((e) => !e.isDnp).length} players in lineup
          {lineup.filter((e) => e.isDnp).length > 0 &&
            ` · ${lineup.filter((e) => e.isDnp).length} DNP`}
        </p>
        <Button
          size="lg"
          className="w-full font-bold"
          onClick={handleStart}
          disabled={isPending}
        >
          {isPending ? "Starting..." : "Start Game"}
        </Button>
      </div>
    </div>
  );
}
