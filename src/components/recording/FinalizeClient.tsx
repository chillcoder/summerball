"use client";

import { useMemo, useState, useTransition } from "react";
import type { AtBat, AtBatOutcome, Game } from "@/types/database";
import {
  OUTCOME_LABELS,
  OUTCOMES_BY_CATEGORY,
  OUTCOME_CATEGORIES,
} from "@/types/database";
import { finalizeGame } from "@/app/actions/games";
import { updateAtBat } from "@/app/actions/atBats";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { posthog } from "@/lib/posthog/client";

// RBIs are only meaningful on outcomes that can drive in a run.
const RBI_ELIGIBLE: AtBatOutcome[] = ["1B", "2B", "3B", "HR", "FC", "ROE", "SAC", "BB"];

export default function FinalizeClient({
  game,
  initialAtBats,
  playerNames,
}: {
  game: Game;
  initialAtBats: AtBat[];
  playerNames: Record<string, string>;
}) {
  const [atBats, setAtBats] = useState<AtBat[]>(
    [...initialAtBats].sort((a, b) => a.sequence_in_game - b.sequence_in_game)
  );
  const [scoreUs, setScoreUs] = useState(
    game.final_score_us != null ? String(game.final_score_us) : ""
  );
  const [scoreThem, setScoreThem] = useState(
    game.final_score_them != null ? String(game.final_score_them) : ""
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totals = useMemo(() => {
    const hits = atBats.filter((a) =>
      ["1B", "2B", "3B", "HR"].includes(a.outcome)
    ).length;
    const rbi = atBats.reduce((s, a) => s + (a.rbis ?? 0), 0);
    return { hits, rbi, count: atBats.length };
  }, [atBats]);

  function setRbi(id: string, delta: number) {
    setAtBats((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, rbis: Math.max(0, Math.min(4, (a.rbis ?? 0) + delta)) }
          : a
      )
    );
  }

  function setOutcome(id: string, outcome: AtBatOutcome) {
    setAtBats((prev) =>
      prev.map((a) => (a.id === id ? { ...a, outcome } : a))
    );
    setEditingId(null);
  }

  function handleFinalize() {
    const rbis: Record<string, number> = {};
    for (const ab of atBats) rbis[ab.id] = ab.rbis ?? 0;

    posthog.capture("game_ended", {
      game_id: game.id,
      duration_min: 0,
      total_at_bats: atBats.length,
      final_score:
        scoreUs && scoreThem ? `${scoreUs}-${scoreThem}` : null,
    });

    // Persist any outcome edits made here, then finalize.
    startTransition(async () => {
      try {
        // Save outcome changes that differ from the originals
        await Promise.all(
          atBats
            .filter((ab) => {
              const orig = initialAtBats.find((o) => o.id === ab.id);
              return orig && orig.outcome !== ab.outcome;
            })
            .map((ab) => updateAtBat(ab.id, { outcome: ab.outcome }))
        );

        await finalizeGame({
          gameId: game.id,
          rbis,
          scoreUs: scoreUs ? parseInt(scoreUs) : null,
          scoreThem: scoreThem ? parseInt(scoreThem) : null,
        });
        // finalizeGame redirects on success
      } catch (err) {
        // redirect() throws NEXT_REDIRECT — let it bubble
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
        toast.error("Failed to finalize game");
      }
    });
  }

  if (atBats.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No at-bats recorded for this game.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Final score */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Us</label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={scoreUs}
            onChange={(e) => setScoreUs(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {game.opponent ?? "Them"}
          </label>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={scoreThem}
            onChange={(e) => setScoreThem(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Running totals */}
      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
        <span>{totals.count} AB logged</span>
        <span>·</span>
        <span>{totals.hits} hits</span>
        <span>·</span>
        <span>{totals.rbi} RBI</span>
      </div>

      {/* At-bat list with RBI steppers */}
      <div className="space-y-2">
        {atBats.map((ab) => {
          const category = OUTCOME_CATEGORIES[ab.outcome];
          const canRbi = RBI_ELIGIBLE.includes(ab.outcome);
          return (
            <div
              key={ab.id}
              className="rounded-lg bg-card border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-sm">
                    {playerNames[ab.player_id] ?? "Player"}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    #{ab.sequence_in_game}
                  </span>
                </div>

                <button
                  onClick={() => setEditingId(editingId === ab.id ? null : ab.id)}
                  className="shrink-0"
                >
                  <Badge
                    variant={category === "hit" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {OUTCOME_LABELS[ab.outcome]}
                  </Badge>
                </button>

                {/* RBI stepper */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground mr-1">RBI</span>
                  <button
                    onClick={() => setRbi(ab.id, -1)}
                    disabled={!canRbi || (ab.rbis ?? 0) === 0}
                    className="w-7 h-7 rounded-md bg-charcoal border border-border disabled:opacity-30 active:scale-95 transition-transform"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-mono font-semibold">
                    {ab.rbis ?? 0}
                  </span>
                  <button
                    onClick={() => setRbi(ab.id, 1)}
                    disabled={!canRbi}
                    className="w-7 h-7 rounded-md bg-charcoal border border-border disabled:opacity-30 active:scale-95 transition-transform"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Outcome editor */}
              {editingId === ab.id && (
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {(["hit", "out", "other"] as const).flatMap((cat) =>
                    OUTCOMES_BY_CATEGORY[cat].map((outcome) => (
                      <button
                        key={outcome}
                        onClick={() => setOutcome(ab.id, outcome)}
                        className={`py-2 px-1 rounded-md text-xs font-medium border transition-colors ${
                          outcome === ab.outcome
                            ? "border-gold bg-bk-teal/25"
                            : "border-border bg-charcoal hover:bg-bk-teal/20"
                        }`}
                      >
                        {outcome}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        size="lg"
        className="w-full font-bold"
        onClick={handleFinalize}
        disabled={isPending}
      >
        {isPending ? "Calculating stats…" : "Calculate Stats & Finalize"}
      </Button>
    </div>
  );
}
