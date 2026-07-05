"use client";

import { useState, useTransition } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { queueUpdateAtBat } from "@/lib/offline/queue";
import type { AtBat, AtBatOutcome } from "@/types/database";
import { OUTCOME_LABELS, OUTCOMES_BY_CATEGORY } from "@/types/database";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { posthog } from "@/lib/posthog/client";

type LineupEntry = {
  player_id: string;
  player: { id: string; name: string };
};

export default function EditLogDrawer({
  open,
  onClose,
  atBats,
  lineup,
  gameId,
  onAtBatUpdated,
  source = "live",
}: {
  open: boolean;
  onClose: () => void;
  atBats: AtBat[];
  lineup: LineupEntry[];
  gameId: string;
  onAtBatUpdated: (ab: AtBat) => void;
  source?: "live" | "post_game";
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const playerMap = Object.fromEntries(lineup.map((e) => [e.player_id, e.player.name]));

  function handleEdit(ab: AtBat, newOutcome: AtBatOutcome) {
    const oldOutcome = ab.outcome;
    const wasPending = ab.is_pending;
    setEditingId(null);

    posthog.capture("at_bat_edited", {
      at_bat_id: ab.id,
      from_outcome: oldOutcome,
      to_outcome: newOutcome,
      source,
    });
    // Picking an outcome for a pending (self-)at-bat also resolves it.
    if (wasPending) {
      posthog.capture("pending_at_bat_resolved", {
        at_bat_id: ab.id,
        resolved_via: "edit_log",
        time_since_created_ms: Date.now() - new Date(ab.recorded_at).getTime(),
      });
    }

    startTransition(async () => {
      try {
        const updates = wasPending
          ? { outcome: newOutcome, is_pending: false }
          : { outcome: newOutcome };
        await queueUpdateAtBat(ab.id, updates);
        onAtBatUpdated({ ...ab, outcome: newOutcome, is_pending: false });
      } catch {
        toast.error("Failed to update at-bat");
      }
    });
  }

  const sorted = [...atBats].sort((a, b) => b.sequence_in_game - a.sequence_in_game);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[80vh] bg-background border-border">
        <SheetHeader>
          <SheetTitle className="text-cream">At-bat log</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto mt-4 space-y-2 pb-8">
          {sorted.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No at-bats yet</p>
          )}
          {sorted.map((ab) => (
            <div key={ab.id} className="p-3 rounded-lg bg-card border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">
                    {playerMap[ab.player_id] ?? "Unknown"}
                  </span>
                  <span className="text-muted-foreground text-xs ml-2">#{ab.sequence_in_game}</span>
                  {ab.is_pending && (
                    <span className="ml-2 text-xs text-amber-400">pending</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{OUTCOME_LABELS[ab.outcome]}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground h-7 px-2"
                    onClick={() => setEditingId(editingId === ab.id ? null : ab.id)}
                  >
                    Edit
                  </Button>
                </div>
              </div>

              {editingId === ab.id && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["hit", "out", "other"] as const).flatMap((cat) =>
                    OUTCOMES_BY_CATEGORY[cat].map((outcome) => (
                      <button
                        key={outcome}
                        onClick={() => handleEdit(ab, outcome)}
                        disabled={isPending}
                        className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors ${
                          outcome === ab.outcome
                            ? "border-gold bg-bk-teal/25"
                            : "border-border bg-charcoal hover:bg-bk-teal/20"
                        }`}
                      >
                        {OUTCOME_LABELS[outcome]}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
