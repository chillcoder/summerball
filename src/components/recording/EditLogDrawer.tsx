"use client";

import { useState, useTransition } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { updateAtBat } from "@/app/actions/atBats";
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
}: {
  open: boolean;
  onClose: () => void;
  atBats: AtBat[];
  lineup: LineupEntry[];
  gameId: string;
  onAtBatUpdated: (ab: AtBat) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const playerMap = Object.fromEntries(lineup.map((e) => [e.player_id, e.player.name]));

  function handleEdit(ab: AtBat, newOutcome: AtBatOutcome) {
    const oldOutcome = ab.outcome;
    setEditingId(null);

    posthog.capture("at_bat_edited", {
      at_bat_id: ab.id,
      from_outcome: oldOutcome,
      to_outcome: newOutcome,
      source: "live",
    });

    startTransition(async () => {
      try {
        await updateAtBat(ab.id, { outcome: newOutcome });
        onAtBatUpdated({ ...ab, outcome: newOutcome });
      } catch {
        toast.error("Failed to update at-bat");
      }
    });
  }

  const sorted = [...atBats].sort((a, b) => b.sequence_in_game - a.sequence_in_game);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[80vh] bg-zinc-950 border-zinc-800">
        <SheetHeader>
          <SheetTitle className="text-white">At-bat log</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto mt-4 space-y-2 pb-8">
          {sorted.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">No at-bats yet</p>
          )}
          {sorted.map((ab) => (
            <div key={ab.id} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">
                    {playerMap[ab.player_id] ?? "Unknown"}
                  </span>
                  <span className="text-zinc-500 text-xs ml-2">#{ab.sequence_in_game}</span>
                  {ab.is_pending && (
                    <span className="ml-2 text-xs text-amber-400">pending</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{OUTCOME_LABELS[ab.outcome]}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-zinc-500 h-7 px-2"
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
                            ? "border-zinc-400 bg-zinc-700"
                            : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
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
