"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { revalidateStatsAfterEdit } from "@/app/actions/games";
import type { AtBat, GameLineup, Player } from "@/types/database";
import { Button } from "@/components/ui/button";
import EditLogDrawer from "./EditLogDrawer";

/**
 * "Edit at-bats" for any game — live or final — reusing the in-game Edit Log.
 * Final-game edits flow straight into season stats (the Postgres views
 * recompute on read); we refresh the page on close so the box score updates.
 */
export default function PastGameEditor({
  gameId,
  initialAtBats,
  lineup,
}: {
  gameId: string;
  initialAtBats: AtBat[];
  lineup: (GameLineup & { player: Player })[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [atBats, setAtBats] = useState(initialAtBats);
  const [dirty, setDirty] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-4"
        onClick={() => setOpen(true)}
      >
        Edit at-bats
      </Button>

      <EditLogDrawer
        open={open}
        onClose={() => {
          setOpen(false);
          if (dirty) {
            setDirty(false);
            // Propagate to /team + player pages (not just this game page), then
            // re-render the current route.
            revalidateStatsAfterEdit().finally(() => router.refresh());
          }
        }}
        atBats={atBats}
        lineup={lineup}
        gameId={gameId}
        source="post_game"
        onAtBatUpdated={(updated) => {
          setDirty(true);
          setAtBats((prev) => prev.map((ab) => (ab.id === updated.id ? updated : ab)));
        }}
      />
    </>
  );
}
