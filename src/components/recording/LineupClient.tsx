"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { addGuestPlayer } from "@/app/actions/roster";
import { recommendLineup } from "@/lib/stats/lineup";
import {
  buildDistributions,
  optimizeLineup,
  type OutcomeCounts,
} from "@/lib/stats/monteCarlo";
import { useGameStore } from "@/stores/gameStore";
import type { Game, GameLineup, Player, PlayerStats } from "@/types/database";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { posthog } from "@/lib/posthog/client";

interface LineupEntry {
  player: Player;
  isDnp: boolean;
}

function SortablePlayer({
  entry,
  position,
  explanation,
  onToggleDnp,
}: {
  entry: LineupEntry;
  position: number;
  explanation?: string;
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
          ? "border-border opacity-40 bg-card/50"
          : "border-border bg-card hover:border-bk-teal/60"
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

      {/* Name + optional recommendation rationale */}
      <div className="flex-1 min-w-0">
        <span className="font-medium">{entry.player.name}</span>
        {entry.player.is_guest && (
          <span className="ml-2 text-xs text-muted-foreground">guest</span>
        )}
        {explanation && !entry.isDnp && (
          <p className="text-xs text-muted-foreground truncate">{explanation}</p>
        )}
      </div>

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
  savedLineup = [],
  statsByPlayer = {},
  outcomeCounts = {},
}: {
  game: Game;
  players: Player[];
  savedLineup?: (GameLineup & { player: Player })[];
  statsByPlayer?: Record<string, PlayerStats>;
  outcomeCounts?: Record<string, OutcomeCounts>;
}) {
  const router = useRouter();
  const selfPlayerId = useGameStore((s) => s.selfPlayerId);
  const setSelfPlayerId = useGameStore((s) => s.setSelfPlayerId);
  const [lineup, setLineup] = useState<LineupEntry[]>(() => seedLineup(players, savedLineup));
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [guestName, setGuestName] = useState("");
  const [simulating, setSimulating] = useState(false);
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
        item.player.id === playerId ? { ...item, isDnp: !item.isDnp } : item
      )
    );
  }

  async function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    setGuestName("");
    try {
      // Persist immediately so the FK is satisfied when the lineup/at-bats save.
      const guest = await addGuestPlayer(name);
      setLineup((prev) => [...prev, { player: guest, isDnp: false }]);
    } catch {
      toast.error("Couldn't add guest");
      setGuestName(name);
    }
  }

  // Batting-order suggestion. With ≥3 games of data this runs the Monte Carlo
  // optimizer (simulated 7-inning games from each player's real outcome
  // distribution); before that it falls back to the rule-based OBP/SLG order.
  function handleSuggest() {
    const gamesPlayed = Math.max(
      0,
      ...Object.values(statsByPlayer).map((s) => s.games_played)
    );

    if (gamesPlayed < 3) {
      const statsMap = new Map<string, PlayerStats>(Object.entries(statsByPlayer));
      const rosterPlayers = lineup.filter((e) => !e.player.is_guest).map((e) => e.player);
      const { entries } = recommendLineup(rosterPlayers, statsMap);

      const byId = new Map(lineup.map((e) => [e.player.id, e]));
      const orderedIds = entries.map((e) => e.player.id);
      const recommended = orderedIds
        .map((id) => byId.get(id))
        .filter((e): e is LineupEntry => Boolean(e));
      const recommendedIds = new Set(orderedIds);
      const leftovers = lineup.filter((e) => !recommendedIds.has(e.player.id));

      const merged = [...recommended, ...leftovers];
      setLineup([...merged.filter((e) => !e.isDnp), ...merged.filter((e) => e.isDnp)]);
      setExplanations(Object.fromEntries(entries.map((e) => [e.player.id, e.explanation])));
      posthog.capture("lineup_recommendation_viewed", {
        game_id: game.id,
        recommended_order: orderedIds,
        method: "rule_based",
        accepted: true,
      });
      toast.success("Alphabetical for now — need 3+ games for the simulator");
      return;
    }

    // Monte Carlo path. setTimeout lets the button repaint to "Simulating…"
    // before the CPU-bound sim starts.
    setSimulating(true);
    setTimeout(() => {
      try {
        const playing = lineup.filter((e) => !e.isDnp);
        const dnp = lineup.filter((e) => e.isDnp);
        const dists = buildDistributions(
          outcomeCounts,
          playing.map((e) => ({ playerId: e.player.id, name: e.player.name }))
        );
        // Seed with the current order so the baseline delta means "vs what
        // you have on screen right now".
        const { order, runsPerGame, baselineRunsPerGame } = optimizeLineup(dists);

        const byId = new Map(playing.map((e) => [e.player.id, e]));
        const optimized = order
          .map((d) => byId.get(d.playerId))
          .filter((e): e is LineupEntry => Boolean(e));
        setLineup([...optimized, ...dnp]);

        setExplanations(
          Object.fromEntries(
            optimized.map((e) => {
              const s = statsByPlayer[e.player.id];
              return [
                e.player.id,
                s && s.pa > 0
                  ? `AVG ${s.avg.toFixed(3)} · OPS ${s.ops.toFixed(3)} over ${s.games_played} games`
                  : "No season data — simulated at team average",
              ];
            })
          )
        );

        const delta = runsPerGame - baselineRunsPerGame;
        toast.success(
          delta > 0.05
            ? `Simulated 1,500 games — ${runsPerGame.toFixed(1)} runs/game (+${delta.toFixed(1)} vs your order)`
            : `Simulated 1,500 games — your order already scores ${baselineRunsPerGame.toFixed(1)} runs/game`
        );
        posthog.capture("lineup_recommendation_viewed", {
          game_id: game.id,
          recommended_order: order.map((d) => d.playerId),
          method: "monte_carlo",
          runs_per_game: Number(runsPerGame.toFixed(2)),
          baseline_runs_per_game: Number(baselineRunsPerGame.toFixed(2)),
          accepted: true,
        });
      } finally {
        setSimulating(false);
      }
    }, 30);
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
        if (game.status === "live") {
          // Mid-game edit: lineup already saved, just go back to recording.
          router.push(`/record/${game.id}`);
        } else {
          await startGame(game.id); // sets status=live + redirects to /record
        }
      } catch {
        toast.error("Failed to save lineup");
      }
    });
  }

  // Number only the playing slots; DNP rows show "–".
  let playingPosition = 0;
  const startLabel = game.status === "live" ? "Save & Resume" : "Start Game";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <span className="shrink-0">You bat as</span>
          <select
            value={selfPlayerId ?? ""}
            onChange={(e) => setSelfPlayerId(e.target.value || null)}
            className="bg-card border border-border rounded px-2 py-1 text-foreground text-xs max-w-[9rem] truncate"
          >
            <option value="">— not playing —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" size="sm" onClick={handleSuggest} disabled={simulating}>
          {simulating ? "Simulating…" : "✨ Suggest order"}
        </Button>
      </div>

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
                  explanation={explanations[entry.player.id]}
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
          className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
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
          {isPending ? "Saving..." : startLabel}
        </Button>
      </div>
    </div>
  );
}

// Seed editor state: hydrate from a previously-saved lineup (preserving order +
// DNP) when present, then append any roster players not yet in it. Falls back to
// the full roster for a brand-new game.
function seedLineup(
  players: Player[],
  savedLineup: (GameLineup & { player: Player })[]
): LineupEntry[] {
  if (savedLineup.length === 0) {
    return players.map((p) => ({ player: p, isDnp: false }));
  }
  const rank = (e: GameLineup) =>
    e.status === "dnp" ? 9999 : e.batting_position ?? 999;
  const ordered = [...savedLineup].sort((a, b) => rank(a) - rank(b));
  const seeded = ordered.map((e) => ({
    player: e.player,
    isDnp: e.status === "dnp",
  }));
  const seen = new Set(seeded.map((s) => s.player.id));
  const extras = players
    .filter((p) => !seen.has(p.id))
    .map((p) => ({ player: p, isDnp: false }));
  return [...seeded, ...extras];
}
