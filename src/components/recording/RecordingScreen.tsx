"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { posthog } from "@/lib/posthog/client";
import { recordAtBat, deleteAtBat, updateAtBat } from "@/app/actions/atBats";
import type { AtBat, AtBatOutcome, Game, OutcomeCategory } from "@/types/database";
import {
  OUTCOMES_BY_CATEGORY,
  OUTCOME_LABELS,
  OUTCOME_CATEGORIES,
} from "@/types/database";
import { Badge } from "@/components/ui/badge";
import EditLogDrawer from "./EditLogDrawer";

// Outcomes that can drive in a run — only these surface the live RBI stepper.
const RBI_ELIGIBLE: AtBatOutcome[] = ["1B", "2B", "3B", "HR", "FC", "ROE", "SAC", "BB"];

type GameLineupEntry = {
  id: string;
  game_id: string;
  player_id: string;
  batting_position: number | null;
  status: string;
  player: { id: string; name: string };
};

type Step = { type: "category" } | { type: "outcome"; category: OutcomeCategory; step1Time: number };

function haptic(pattern: number[]) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

function computeTodayStats(atBats: AtBat[], playerId: string) {
  const abs = atBats.filter((ab) => ab.player_id === playerId && !ab.is_pending);
  const hits = abs.filter((ab) => ["1B", "2B", "3B", "HR"].includes(ab.outcome)).length;
  const ab = abs.filter((ab) => !["BB", "SAC"].includes(ab.outcome)).length;
  return { hits, ab };
}

export default function RecordingScreen({
  game,
  lineup,
  initialAtBats,
  userId,
}: {
  game: Game;
  lineup: GameLineupEntry[];
  initialAtBats: AtBat[];
  userId: string;
}) {
  const [atBats, setAtBats] = useState<AtBat[]>(initialAtBats);
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Resume from where we left off based on sequence count
    if (initialAtBats.length === 0 || lineup.length === 0) return 0;
    const lastSequence = Math.max(...initialAtBats.map((ab) => ab.sequence_in_game));
    // Count how many times each position has batted
    const absByPlayer: Record<string, number> = {};
    for (const ab of initialAtBats) {
      absByPlayer[ab.player_id] = (absByPlayer[ab.player_id] ?? 0) + 1;
    }
    // Find the next batter in lineup cycle
    const lastAb = initialAtBats.find((ab) => ab.sequence_in_game === lastSequence);
    if (!lastAb) return 0;
    const lastIdx = lineup.findIndex((e) => e.player_id === lastAb.player_id);
    return lastIdx >= 0 ? (lastIdx + 1) % lineup.length : 0;
  });
  const [step, setStep] = useState<Step>({ type: "category" });
  const [undoAb, setUndoAb] = useState<{ ab: AtBat; expiresAt: number } | null>(null);
  // The just-committed run-scoring at-bat, shown with a live RBI stepper until
  // the next at-bat is recorded. Keyed by sequence (stable across optimistic→saved).
  const [rbiBar, setRbiBar] = useState<{ seq: number; playerName: string; outcome: AtBatOutcome } | null>(null);
  const [showEditLog, setShowEditLog] = useState(false);
  const [pendingCount] = useState(initialAtBats.filter((ab) => ab.is_pending).length);
  const lastAbTimeRef = useRef<number | null>(null);
  const step1TimeRef = useRef<number>(0);
  const router = useRouter();

  const currentBatter = lineup[currentIndex];
  const onDeckBatter = lineup[(currentIndex + 1) % lineup.length];

  // Track today stats (current game)
  const currentTodayStats = currentBatter ? computeTodayStats(atBats, currentBatter.player_id) : null;

  // Clear undo after 3s
  useEffect(() => {
    if (!undoAb) return;
    const timer = setTimeout(() => setUndoAb(null), 3000);
    return () => clearTimeout(timer);
  }, [undoAb]);

  const handleCategoryTap = useCallback((category: OutcomeCategory) => {
    haptic([30]);
    step1TimeRef.current = Date.now();
    setStep({ type: "outcome", category, step1Time: step1TimeRef.current });
  }, []);

  const handleOutcomeTap = useCallback(async (outcome: AtBatOutcome) => {
    if (!currentBatter) return;
    haptic([30, 50, 30]);

    const category = OUTCOME_CATEGORIES[outcome];
    const now = Date.now();
    const step1Time = "step1Time" in step ? step.step1Time : now;
    const timeSinceLastAb = lastAbTimeRef.current ? now - lastAbTimeRef.current : null;
    const timeStep1ToStep2 = now - step1Time;

    const sequenceInGame = atBats.length + 1;

    // Optimistic local state
    const optimisticAb: AtBat = {
      id: crypto.randomUUID(),
      game_id: game.id,
      player_id: currentBatter.player_id,
      sequence_in_game: sequenceInGame,
      outcome,
      rbis: 0,
      runs_scored: 0,
      recorded_by_user_id: userId,
      recorded_at: new Date().toISOString(),
      is_pending: false,
      was_self_ab: false,
    };

    setAtBats((prev) => [...prev, optimisticAb]);
    setUndoAb({ ab: optimisticAb, expiresAt: now + 3000 });
    lastAbTimeRef.current = now;

    // Surface the live RBI stepper for run-scoring outcomes; clear it otherwise.
    setRbiBar(
      RBI_ELIGIBLE.includes(outcome)
        ? { seq: sequenceInGame, playerName: currentBatter.player.name, outcome }
        : null
    );

    // Advance batter
    setCurrentIndex((i) => (i + 1) % lineup.length);
    setStep({ type: "category" });

    // PostHog event
    posthog.capture("at_bat_recorded", {
      game_id: game.id,
      player_id: currentBatter.player_id,
      outcome,
      category,
      time_step1_to_step2_ms: timeStep1ToStep2,
      time_since_last_ab_ms: timeSinceLastAb,
      was_self_ab: false,
    });

    // Persist to Supabase (fire-and-forget, handle error gracefully)
    try {
      const saved = await recordAtBat({
        gameId: game.id,
        playerId: currentBatter.player_id,
        outcome,
        sequenceInGame,
      });
      // Replace optimistic AB with server response, preserving any RBIs the
      // recorder may have already tapped during the save window.
      setAtBats((prev) =>
        prev.map((ab) => {
          if (ab.id !== optimisticAb.id) return ab;
          const preservedRbis = ab.rbis ?? 0;
          if (preservedRbis > 0) {
            updateAtBat(saved.id, { rbis: preservedRbis }).catch(() => {});
          }
          return { ...saved, rbis: preservedRbis };
        })
      );
      setUndoAb((prev) =>
        prev?.ab.id === optimisticAb.id ? { ab: saved, expiresAt: prev.expiresAt } : prev
      );
    } catch {
      toast.error("Sync failed — will retry");
    }
  }, [currentBatter, game.id, atBats.length, lineup.length, step, userId]);

  const handleSetRbi = useCallback((seq: number, delta: number) => {
    haptic([20]);
    setAtBats((prev) =>
      prev.map((ab) => {
        if (ab.sequence_in_game !== seq) return ab;
        const next = Math.max(0, Math.min(4, (ab.rbis ?? 0) + delta));
        // Persist using the at-bat's current id (already saved by the time the
        // recorder taps RBI in the common case; re-persisted on save otherwise).
        updateAtBat(ab.id, { rbis: next }).catch(() => {});
        return { ...ab, rbis: next };
      })
    );
  }, []);

  async function handleUndo() {
    if (!undoAb) return;
    const { ab } = undoAb;
    const timeToUndo = Date.now() - (undoAb.expiresAt - 3000);
    setAtBats((prev) => prev.filter((a) => a.id !== ab.id));
    setUndoAb(null);
    setRbiBar((prev) => (prev?.seq === ab.sequence_in_game ? null : prev));
    // Go back one batter
    setCurrentIndex((i) => (i - 1 + lineup.length) % lineup.length);
    setStep({ type: "category" });

    posthog.capture("at_bat_undone", { at_bat_id: ab.id, time_to_undo_ms: timeToUndo });

    try {
      await deleteAtBat(ab.id);
    } catch {
      toast.error("Undo sync failed");
    }
  }

  function handleSkip() {
    posthog.capture("batter_skipped", {
      game_id: game.id,
      player_id: currentBatter?.player_id ?? "",
      reason: "manual_skip",
    });
    setCurrentIndex((i) => (i + 1) % lineup.length);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-green-600 text-green-400 text-xs">LIVE</Badge>
          <span className="text-sm text-zinc-400">
            {game.opponent ? `vs ${game.opponent}` : "Game"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-xs">{pendingCount} pending</Badge>
          )}
          <button
            onClick={() => setShowEditLog(true)}
            className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded"
          >
            Edit Log
          </button>
          <button
            onClick={() => router.push(`/games/${game.id}/finalize`)}
            className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded"
          >
            End
          </button>
        </div>
      </div>

      {/* Current batter */}
      <div className="px-4 pt-6 pb-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Now batting</p>
        <h1 className="text-4xl font-bold tracking-tight">
          {currentBatter?.player.name ?? "—"}
        </h1>
        {currentTodayStats && (
          <p className="text-zinc-400 text-sm mt-1">
            {currentTodayStats.hits}-for-{currentTodayStats.ab} today
          </p>
        )}
      </div>

      {/* On-deck batter */}
      {onDeckBatter && onDeckBatter.player_id !== currentBatter?.player_id && (
        <div className="px-4 pb-4">
          <p className="text-xs text-zinc-600">
            On deck: <span className="text-zinc-400">{onDeckBatter.player.name}</span>
          </p>
        </div>
      )}

      {/* At-bat count */}
      <div className="px-4 pb-4 text-xs text-zinc-600">
        AB #{atBats.filter((ab) => !ab.is_pending).length + 1} · {lineup.length} batters
      </div>

      {/* Action zone — bottom 60% */}
      <div className="flex-1 flex flex-col justify-end px-4 pb-safe pb-8 gap-3">

        {/* Live RBI stepper for the last run-scoring at-bat */}
        {rbiBar && (
          <div className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700">
            <div className="min-w-0 text-sm">
              <span className="font-medium">{rbiBar.playerName}</span>
              <span className="text-zinc-500 ml-2">{OUTCOME_LABELS[rbiBar.outcome]}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-zinc-500">RBI</span>
              <button
                onClick={() => handleSetRbi(rbiBar.seq, -1)}
                className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-600 text-xl leading-none active:scale-90 transition-transform"
                aria-label="Remove RBI"
              >
                −
              </button>
              <span className="w-6 text-center font-mono text-lg font-bold text-amber-300">
                {atBats.find((a) => a.sequence_in_game === rbiBar.seq)?.rbis ?? 0}
              </span>
              <button
                onClick={() => handleSetRbi(rbiBar.seq, 1)}
                className="w-9 h-9 rounded-lg bg-amber-800/70 border border-amber-600 text-xl leading-none text-amber-200 active:scale-90 transition-transform"
                aria-label="Add RBI"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Undo toast */}
        {undoAb && (
          <button
            onClick={handleUndo}
            className="w-full py-3 rounded-xl bg-amber-900/60 border border-amber-700 text-amber-300 font-medium text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            ↩ Undo {OUTCOME_LABELS[undoAb.ab.outcome]}
          </button>
        )}

        {step.type === "category" ? (
          <>
            {/* Step 1: Category */}
            <CategoryButton
              label="HIT"
              color="green"
              onTap={() => handleCategoryTap("hit")}
            />
            <CategoryButton
              label="OUT"
              color="red"
              onTap={() => handleCategoryTap("out")}
            />
            <CategoryButton
              label="OTHER"
              color="zinc"
              onTap={() => handleCategoryTap("other")}
              sublabel="Walk · Error · SAC"
            />

            {/* Skip batter */}
            <button
              onClick={handleSkip}
              className="text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-2"
            >
              Skip {currentBatter?.player.name}
            </button>
          </>
        ) : (
          <>
            {/* Step 2: Specific outcome */}
            <div className="grid grid-cols-2 gap-3">
              {OUTCOMES_BY_CATEGORY[step.category].map((outcome) => (
                <OutcomeButton
                  key={outcome}
                  outcome={outcome}
                  onTap={() => handleOutcomeTap(outcome)}
                />
              ))}
            </div>

            {/* Back arrow */}
            <button
              onClick={() => {
                posthog.capture("at_bat_category_changed", {
                  game_id: game.id,
                  from_category: step.category,
                  to_category: step.category, // will be changed on next selection
                });
                setStep({ type: "category" });
              }}
              className="text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-2 flex items-center justify-center gap-1"
            >
              ← Back
            </button>
          </>
        )}
      </div>

      <EditLogDrawer
        open={showEditLog}
        onClose={() => setShowEditLog(false)}
        atBats={atBats}
        lineup={lineup}
        gameId={game.id}
        onAtBatUpdated={(updated) =>
          setAtBats((prev) => prev.map((ab) => (ab.id === updated.id ? updated : ab)))
        }
      />
    </div>
  );
}

function CategoryButton({
  label,
  color,
  onTap,
  sublabel,
}: {
  label: string;
  color: "green" | "red" | "zinc";
  onTap: () => void;
  sublabel?: string;
}) {
  const colorMap = {
    green: "bg-green-700 hover:bg-green-600 active:bg-green-800 border-green-600",
    red: "bg-red-800 hover:bg-red-700 active:bg-red-900 border-red-700",
    zinc: "bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 border-zinc-700",
  };

  return (
    <button
      onClick={onTap}
      className={`w-full py-6 rounded-2xl border font-bold text-2xl tracking-wide transition-all active:scale-98 ${colorMap[color]}`}
    >
      {label}
      {sublabel && (
        <p className="text-xs font-normal text-white/60 mt-0.5">{sublabel}</p>
      )}
    </button>
  );
}

function OutcomeButton({
  outcome,
  onTap,
}: {
  outcome: AtBatOutcome;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="w-full py-7 rounded-2xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 font-bold text-lg tracking-wide transition-all active:scale-98"
    >
      {OUTCOME_LABELS[outcome]}
    </button>
  );
}
