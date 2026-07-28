"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGameDetails } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Game } from "@/types/database";

export default function GameDetailsEditor({ game }: { game: Game }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [playedAt, setPlayedAt] = useState(game.played_at.slice(0, 10));
  const [opponent, setOpponent] = useState(game.opponent ?? "");
  const [scoreUs, setScoreUs] = useState(game.final_score_us?.toString() ?? "");
  const [scoreThem, setScoreThem] = useState(game.final_score_them?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateGameDetails(game.id, {
          playedAt,
          opponent,
          scoreUs: scoreUs === "" ? null : Number(scoreUs),
          scoreThem: scoreThem === "" ? null : Number(scoreThem),
        });
        toast.success("Game details updated");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Couldn't save game details");
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setOpen(true)}>
        Edit game details
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-lg bg-card border border-border p-4 space-y-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Game details</p>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Date</label>
        <input
          type="date"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Opponent</label>
        <input
          type="text"
          value={opponent}
          placeholder="Opponent name"
          onChange={(e) => setOpponent(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Us</label>
          <input
            type="number"
            inputMode="numeric"
            value={scoreUs}
            onChange={(e) => setScoreUs(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Them</label>
          <input
            type="number"
            inputMode="numeric"
            value={scoreThem}
            onChange={(e) => setScoreThem(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1 font-medium" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
