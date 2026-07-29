"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { posthog } from "@/lib/posthog/client";
import {
  queueRecordAtBat,
  queueUpdateAtBat,
  queueDeleteAtBat,
  queueSetInning,
  queueSetInningRuns,
  useSyncStatus,
} from "@/lib/offline/queue";
import type { AtBat, AtBatOutcome, Game, GameInning, OutcomeCategory, PlayerStats } from "@/types/database";
import {
  OUTCOMES_BY_CATEGORY,
  OUTCOME_LABELS,
  OUTCOME_CATEGORIES,
} from "@/types/database";
import { formatStat } from "@/lib/stats/compute";
import { Badge } from "@/components/ui/badge";
import { useGameStore, type SelfAbMode } from "@/stores/gameStore";
import GlossarySheet from "@/components/GlossarySheet";
import EditLogDrawer from "./EditLogDrawer";

// Outcomes that can drive in a run — only these surface the RBI stepper.
const RBI_ELIGIBLE: AtBatOutcome[] = ["1B", "2B", "3B", "HR", "FC", "ROE", "SAC", "BB"];

// A HR always drives in the batter himself; a sac fly by definition scores a
// runner. Everything else starts at 0 and is bumped with the stepper.
const DEFAULT_RBIS: Partial<Record<AtBatOutcome, number>> = { HR: 1, SAC: 1 };

// Placeholder outcome stored on a "fill in after" pending at-bat. While pending
// it's excluded from every stat view, so the value is irrelevant until resolved.
const PENDING_PLACEHOLDER: AtBatOutcome = "groundout";

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

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
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
  statsByPlayer = {},
  initialInningRuns = [],
}: {
  game: Game;
  lineup: GameLineupEntry[];
  initialAtBats: AtBat[];
  userId: string;
  statsByPlayer?: Record<string, PlayerStats>;
  initialInningRuns?: GameInning[];
}) {
  const [atBats, setAtBats] = useState<AtBat[]>(initialAtBats);
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Resume from where we left off based on sequence count
    if (initialAtBats.length === 0 || lineup.length === 0) return 0;
    const lastSequence = Math.max(...initialAtBats.map((ab) => ab.sequence_in_game));
    const lastAb = initialAtBats.find((ab) => ab.sequence_in_game === lastSequence);
    if (!lastAb) return 0;
    const lastIdx = lineup.findIndex((e) => e.player_id === lastAb.player_id);
    return lastIdx >= 0 ? (lastIdx + 1) % lineup.length : 0;
  });
  const [step, setStep] = useState<Step>({ type: "category" });
  // The just-recorded at-bat: shown in the last-play bar with RBI stepper +
  // Undo until the next at-bat replaces it. Resolved from atBats by id so
  // RBI edits stay in sync.
  const [lastPlayId, setLastPlayId] = useState<string | null>(null);
  const [inning, setInning] = useState(game.current_inning ?? 1);
  // Real runs per inning (our offense), keyed by inning number.
  const [inningRuns, setInningRuns] = useState<Record<number, number>>(() =>
    Object.fromEntries(initialInningRuns.map((r) => [r.inning, r.runs]))
  );
  const [showEditLog, setShowEditLog] = useState(false);
  const unsynced = useSyncStatus();
  // self-AB flow state: null = normal; "choosing" = the recorder is up and
  // picking how to handle it; "recording" = they chose to record it now.
  const [selfFlow, setSelfFlow] = useState<null | "choosing" | "recording">(null);
  const lastAbTimeRef = useRef<number | null>(null);
  const step1TimeRef = useRef<number>(0);
  const router = useRouter();

  const selfPlayerId = useGameStore((s) => s.selfPlayerId);
  const preferredSelfAbMode = useGameStore((s) => s.preferredSelfAbMode);
  const setSelfAbMode = useGameStore((s) => s.setSelfAbMode);

  const pendingCount = atBats.filter((ab) => ab.is_pending).length;
  const currentBatter = lineup[currentIndex];
  const onDeckBatter = lineup[(currentIndex + 1) % lineup.length];
  const isSelfAtBat = !!selfPlayerId && currentBatter?.player_id === selfPlayerId;

  const currentTodayStats = currentBatter ? computeTodayStats(atBats, currentBatter.player_id) : null;
  const currentSeasonStats = currentBatter ? statsByPlayer[currentBatter.player_id] : undefined;
  const onDeckSeasonStats = onDeckBatter ? statsByPlayer[onDeckBatter.player_id] : undefined;
  const lastAbForBatter = currentBatter
    ? [...atBats].reverse().find((ab) => ab.player_id === currentBatter.player_id)
    : undefined;

  const lastPlay = lastPlayId ? atBats.find((ab) => ab.id === lastPlayId) : undefined;
  const lastPlayName = lastPlay
    ? lineup.find((e) => e.player_id === lastPlay.player_id)?.player.name ?? "—"
    : "";
  // Only the most recent at-bat is undoable — protects sequence integrity.
  const lastPlayUndoable =
    !!lastPlay && atBats.length > 0 && atBats[atBats.length - 1].id === lastPlay.id;

  // When the recorder's own spot comes up, surface the self-AB chooser; reset
  // once the lineup has moved on.
  useEffect(() => {
    if (isSelfAtBat) {
      setSelfFlow((f) => (f === null ? "choosing" : f));
    } else {
      setSelfFlow((f) => (f === null ? f : null));
    }
  }, [isSelfAtBat]);

  const handleCategoryTap = useCallback((category: OutcomeCategory) => {
    haptic([30]);
    step1TimeRef.current = Date.now();
    setStep({ type: "outcome", category, step1Time: step1TimeRef.current });
  }, []);

  const handleOutcomeTap = useCallback(async (outcome: AtBatOutcome, wasSelfAb = false) => {
    if (!currentBatter) return;
    haptic([30, 50, 30]);

    const category = OUTCOME_CATEGORIES[outcome];
    const now = Date.now();
    const step1Time = "step1Time" in step ? step.step1Time : now;
    const timeSinceLastAb = lastAbTimeRef.current ? now - lastAbTimeRef.current : null;
    const timeStep1ToStep2 = now - step1Time;

    const sequenceInGame = atBats.length + 1;
    const autoRbis = DEFAULT_RBIS[outcome] ?? 0;

    // Optimistic local state
    const optimisticAb: AtBat = {
      id: crypto.randomUUID(),
      game_id: game.id,
      player_id: currentBatter.player_id,
      sequence_in_game: sequenceInGame,
      inning,
      outcome,
      rbis: autoRbis,
      runs_scored: 0,
      recorded_by_user_id: userId,
      recorded_at: new Date().toISOString(),
      is_pending: false,
      was_self_ab: wasSelfAb,
    };

    setAtBats((prev) => [...prev, optimisticAb]);
    setLastPlayId(optimisticAb.id);
    lastAbTimeRef.current = now;

    // Advance batter
    setCurrentIndex((i) => (i + 1) % lineup.length);
    setStep({ type: "category" });

    posthog.capture("at_bat_recorded", {
      game_id: game.id,
      player_id: currentBatter.player_id,
      outcome,
      category,
      time_step1_to_step2_ms: timeStep1ToStep2,
      time_since_last_ab_ms: timeSinceLastAb,
      was_self_ab: wasSelfAb,
    });

    // Durable write: queue to IndexedDB (survives a dead signal) keyed by the
    // same client id the UI holds, so RBI edits / undo target a stable row.
    try {
      await queueRecordAtBat({
        id: optimisticAb.id,
        gameId: game.id,
        playerId: currentBatter.player_id,
        outcome,
        sequenceInGame,
        inning,
        rbis: autoRbis,
        wasSelfAb,
      });
    } catch {
      toast.error("Couldn't save locally — check storage");
    }
  }, [currentBatter, game.id, atBats.length, lineup.length, step, userId, inning]);

  // "Fill in after": log a pending placeholder for the recorder's at-bat and
  // advance. Resolved later from the Edit Log (which clears is_pending).
  const recordSelfPending = useCallback(() => {
    if (!currentBatter) return;
    haptic([30, 50, 30]);
    const sequenceInGame = atBats.length + 1;
    const ab: AtBat = {
      id: crypto.randomUUID(),
      game_id: game.id,
      player_id: currentBatter.player_id,
      sequence_in_game: sequenceInGame,
      inning,
      outcome: PENDING_PLACEHOLDER,
      rbis: 0,
      runs_scored: 0,
      recorded_by_user_id: userId,
      recorded_at: new Date().toISOString(),
      is_pending: true,
      was_self_ab: true,
    };
    setAtBats((prev) => [...prev, ab]);
    setLastPlayId(ab.id);
    setCurrentIndex((i) => (i + 1) % lineup.length);
    setStep({ type: "category" });
    setSelfAbMode("pending");
    posthog.capture("self_ab_mode_chosen", { mode: "pending" });
    void queueRecordAtBat({
      id: ab.id,
      gameId: game.id,
      playerId: currentBatter.player_id,
      outcome: PENDING_PLACEHOLDER,
      sequenceInGame,
      inning,
      isPending: true,
      wasSelfAb: true,
    });
    toast("Marked pending — resolve it from the Edit Log");
  }, [currentBatter, game.id, atBats.length, lineup.length, userId, inning, setSelfAbMode]);

  const handleSetRbi = useCallback((atBatId: string, delta: number) => {
    haptic([20]);
    setAtBats((prev) =>
      prev.map((ab) => {
        if (ab.id !== atBatId) return ab;
        const next = Math.max(0, Math.min(4, (ab.rbis ?? 0) + delta));
        if (next !== ab.rbis) void queueUpdateAtBat(ab.id, { rbis: next });
        return { ...ab, rbis: next };
      })
    );
  }, []);

  function handleUndo() {
    if (!lastPlay || !lastPlayUndoable) return;
    haptic([20]);
    const timeToUndo = Date.now() - new Date(lastPlay.recorded_at).getTime();
    setAtBats((prev) => prev.filter((a) => a.id !== lastPlay.id));
    setLastPlayId(null);
    // Go back one batter
    setCurrentIndex((i) => (i - 1 + lineup.length) % lineup.length);
    setStep({ type: "category" });

    posthog.capture("at_bat_undone", { at_bat_id: lastPlay.id, time_to_undo_ms: timeToUndo });

    // Queue the delete; if the insert hasn't synced yet the queue cancels both.
    void queueDeleteAtBat(lastPlay.id);
  }

  function handleEndInning() {
    haptic([30]);
    const next = inning + 1;
    setInning(next);
    void queueSetInning(game.id, next);
    toast(`Inning ${next}`);
  }

  function bumpRuns(delta: number) {
    haptic([20]);
    setInningRuns((prev) => {
      const next = Math.max(0, (prev[inning] ?? 0) + delta);
      void queueSetInningRuns(game.id, inning, next);
      return { ...prev, [inning]: next };
    });
  }

  const runsThisInning = inningRuns[inning] ?? 0;
  const totalRuns = Object.values(inningRuns).reduce((s, r) => s + r, 0);

  function handleSkip() {
    posthog.capture("batter_skipped", {
      game_id: game.id,
      player_id: currentBatter?.player_id ?? "",
      reason: "manual_skip",
    });
    setCurrentIndex((i) => (i + 1) % lineup.length);
  }

  const lastPlayRbiEligible =
    !!lastPlay && !lastPlay.is_pending && RBI_ELIGIBLE.includes(lastPlay.outcome);

  return (
    <div className="min-h-screen flex flex-col bg-background text-cream select-none">
      {game.is_exhibition && (
        <div className="bg-amber-deep text-ink text-center text-xs font-bold py-1 tracking-wide">
          TEST GAME — not counted toward season stats
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="border-bk-teal text-bk-teal text-xs shrink-0">LIVE</Badge>
          <span className="border border-amber-deep/70 text-gold text-[11px] rounded px-1.5 py-px shrink-0">
            Inn {inning}
          </span>
          {unsynced > 0 ? (
            <span className="text-xs text-gold flex items-center gap-1 shrink-0" title="At-bats saved locally, syncing when online">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              {unsynced}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1 shrink-0" title="All at-bats synced">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-bk-teal" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {pendingCount > 0 && (
            <button onClick={() => setShowEditLog(true)} aria-label="Resolve pending at-bats">
              <Badge variant="destructive" className="text-xs">{pendingCount} pending</Badge>
            </button>
          )}
          <GlossarySheet />
          <button
            onClick={() => router.push(`/games/${game.id}/lineup`)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded"
          >
            Lineup
          </button>
          <button
            onClick={() => setShowEditLog(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded"
          >
            Edit Log
          </button>
          <button
            onClick={() => router.push(`/games/${game.id}/finalize`)}
            className="text-xs font-medium text-gold hover:text-amber-deep transition-colors px-1.5 py-1 rounded"
          >
            End game
          </button>
        </div>
      </div>

      {/* Hero: current batter stat card (animates on batter change) */}
      <div
        key={`${currentBatter?.player_id ?? "none"}-${currentIndex}`}
        className="px-4 pt-4 pb-2 animate-batter-in"
      >
        <div className="rounded-2xl bg-card border border-border border-l-4 border-l-gold px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="bg-gold text-ink text-xs font-bold rounded-full px-2.5 py-0.5">
              {ordinal(currentIndex + 1)}
            </span>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Now batting
            </span>
            {game.opponent && (
              <span className="ml-auto text-[11px] text-muted-foreground/70 truncate">
                vs {game.opponent}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-bold tracking-tight mt-1.5">
            {currentBatter?.player.name ?? "—"}
          </h1>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {currentTodayStats && (
              <span className="bg-bk-teal/20 text-cream text-xs rounded-md px-2 py-0.5">
                Today {currentTodayStats.hits}-for-{currentTodayStats.ab}
              </span>
            )}
            {currentSeasonStats && currentSeasonStats.ab > 0 && (
              <>
                <span className="bg-bk-teal/20 text-cream text-xs rounded-md px-2 py-0.5">
                  AVG {formatStat(currentSeasonStats.avg, "avg")}
                </span>
                <span className="bg-bk-teal/20 text-cream text-xs rounded-md px-2 py-0.5">
                  OPS {formatStat(currentSeasonStats.ops, "ops")}
                </span>
              </>
            )}
          </div>
          {lastAbForBatter && (
            <p className="text-xs text-gold/90 mt-2">
              Last AB:{" "}
              {lastAbForBatter.is_pending ? "Pending" : OUTCOME_LABELS[lastAbForBatter.outcome]}
            </p>
          )}
        </div>

        {/* On-deck */}
        {onDeckBatter && onDeckBatter.player_id !== currentBatter?.player_id && (
          <p className="text-xs text-muted-foreground/70 mt-2 ml-1">
            On deck: <span className="text-muted-foreground">{onDeckBatter.player.name}</span>
            {onDeckSeasonStats && onDeckSeasonStats.ab > 0 && (
              <span className="text-muted-foreground/70">
                {" "}· {formatStat(onDeckSeasonStats.avg, "avg")}
              </span>
            )}
          </p>
        )}

        {/* Runs this inning — tap + as runs cross the plate (counts error/FC runs too) */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-card border border-border px-3 py-2">
          <div className="text-xs min-w-0">
            <span className="text-muted-foreground">Inn {inning} runs</span>
            <span className="text-muted-foreground/60 ml-2">· {totalRuns} total</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => bumpRuns(-1)}
              className="w-9 h-9 rounded-lg bg-background border border-border text-xl leading-none active:scale-90 transition-transform"
              aria-label="Remove run this inning"
            >
              −
            </button>
            <span className="w-6 text-center font-mono text-lg font-bold text-gold">{runsThisInning}</span>
            <button
              onClick={() => bumpRuns(1)}
              className="w-9 h-9 rounded-lg bg-gold text-ink border border-amber-deep text-xl leading-none active:scale-90 transition-transform"
              aria-label="Add run this inning"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Action zone — bottom of the screen */}
      <div className="flex-1 flex flex-col justify-end px-4 pb-safe pb-6 gap-3">

        {/* Last play bar: outcome + RBI stepper + undo, until the next AB */}
        {lastPlay && (
          <div
            key={lastPlay.id}
            className="animate-bar-pop w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-card border border-border"
          >
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground/70">Last play</p>
              <p className="text-sm truncate">
                <span className="font-medium">{lastPlayName}</span>
                <span className="text-gold ml-1.5">
                  {lastPlay.is_pending ? "Pending" : OUTCOME_LABELS[lastPlay.outcome]}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lastPlayUndoable && (
                <button
                  onClick={handleUndo}
                  className="text-xs text-gold border border-gold/50 rounded-lg px-2.5 py-2 active:scale-95 transition-transform"
                >
                  ↩ Undo
                </button>
              )}
              {lastPlayRbiEligible && (
                <>
                  <button
                    onClick={() => handleSetRbi(lastPlay.id, -1)}
                    className="w-9 h-9 rounded-lg bg-background border border-border text-xl leading-none active:scale-90 transition-transform"
                    aria-label="Remove RBI"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-mono text-lg font-bold text-gold">
                    {lastPlay.rbis ?? 0}
                  </span>
                  <button
                    onClick={() => handleSetRbi(lastPlay.id, 1)}
                    className="w-9 h-9 rounded-lg bg-amber-deep text-ink border border-gold text-xl leading-none active:scale-90 transition-transform"
                    aria-label="Add RBI"
                  >
                    +
                  </button>
                  <span className="text-[11px] text-muted-foreground/70">RBI</span>
                </>
              )}
            </div>
          </div>
        )}

        {selfFlow === "choosing" ? (
          <SelfAbPanel
            nextName={onDeckBatter?.player.name}
            preferred={preferredSelfAbMode}
            onRecordNow={() => {
              setSelfAbMode("handoff");
              posthog.capture("self_ab_mode_chosen", { mode: "handoff" });
              setSelfFlow("recording");
            }}
            onFillInAfter={recordSelfPending}
          />
        ) : (
          <>
            {selfFlow === "recording" && (
              <div className="w-full text-center px-4 py-2 rounded-xl bg-amber-deep/25 border border-gold/60 text-gold text-sm">
                Recording your at-bat — hand the phone to{" "}
                {onDeckBatter?.player.name ?? "a teammate"}
              </div>
            )}

            {step.type === "category" ? (
              <>
                {/* Step 1: Category */}
                <CategoryButton
                  label="HIT"
                  color="gold"
                  onTap={() => handleCategoryTap("hit")}
                />
                <CategoryButton
                  label="OUT"
                  color="red"
                  onTap={() => handleCategoryTap("out")}
                />
                <CategoryButton
                  label="OTHER"
                  color="teal"
                  onTap={() => handleCategoryTap("other")}
                  sublabel="Walk · Error · SAC"
                />
              </>
            ) : (
              <>
                {/* Step 2: Specific outcome */}
                <div className="grid grid-cols-2 gap-3">
                  {OUTCOMES_BY_CATEGORY[step.category].map((outcome) => (
                    <OutcomeButton
                      key={outcome}
                      outcome={outcome}
                      onTap={() => handleOutcomeTap(outcome, selfFlow === "recording")}
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
                  className="text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1"
                >
                  ← Back
                </button>
              </>
            )}

            {/* Utility row */}
            {step.type === "category" && (
              <div className="flex items-center justify-center gap-5 py-1.5">
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors py-1"
                >
                  Skip {currentBatter?.player.name}
                </button>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <button
                  onClick={handleEndInning}
                  className="text-xs text-gold/80 hover:text-gold transition-colors py-1"
                >
                  End inning {inning} →
                </button>
              </div>
            )}
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

function SelfAbPanel({
  nextName,
  preferred,
  onRecordNow,
  onFillInAfter,
}: {
  nextName?: string;
  preferred: SelfAbMode;
  onRecordNow: () => void;
  onFillInAfter: () => void;
}) {
  const base =
    "w-full py-6 rounded-2xl border font-bold text-2xl tracking-wide transition-all active:scale-98";
  const highlight = "bg-amber-deep text-cream hover:bg-gold hover:text-ink border-gold";
  const plain = "bg-charcoal border-border hover:bg-bk-teal/20";

  return (
    <div className="space-y-3">
      <div className="text-center mb-1">
        <p className="text-xs uppercase tracking-widest text-gold mb-1">Your at-bat</p>
        <p className="text-sm text-muted-foreground">You&apos;re up — record it now, or fill it in after.</p>
      </div>
      <button
        onClick={onRecordNow}
        className={`${base} ${preferred === "handoff" ? highlight : plain}`}
      >
        Record now
        <p className="text-xs font-normal opacity-70 mt-0.5">
          Hand to {nextName ?? "a teammate"} to tap the outcome
        </p>
      </button>
      <button
        onClick={onFillInAfter}
        className={`${base} ${preferred === "pending" ? highlight : plain}`}
      >
        Fill in after
        <p className="text-xs font-normal opacity-70 mt-0.5">
          Mark pending · resolve from the Edit Log
        </p>
      </button>
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
  color: "gold" | "red" | "teal";
  onTap: () => void;
  sublabel?: string;
}) {
  const colorMap = {
    gold: "bg-gold hover:bg-amber-deep active:bg-amber-deep border-amber-deep text-ink",
    red: "bg-red-800 hover:bg-red-700 active:bg-red-900 border-red-700 text-cream",
    teal: "bg-bk-teal hover:bg-bk-teal/85 active:bg-bk-teal/75 border-bk-teal text-ink",
  };

  return (
    <button
      onClick={onTap}
      className={`w-full py-6 rounded-2xl border font-bold text-2xl tracking-wide transition-all active:scale-98 ${colorMap[color]}`}
    >
      {label}
      {sublabel && (
        <p className="text-xs font-normal opacity-70 mt-0.5">{sublabel}</p>
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
      className="w-full py-7 rounded-2xl border border-border bg-charcoal hover:bg-bk-teal/20 active:bg-ink text-cream font-bold text-lg tracking-wide transition-all active:scale-98"
    >
      {OUTCOME_LABELS[outcome]}
    </button>
  );
}
