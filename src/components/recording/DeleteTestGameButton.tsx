"use client";

import { useTransition } from "react";
import { deleteGame } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DeleteTestGameButton({ gameId }: { gameId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      className="w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
      disabled={isPending}
      onClick={() => {
        if (
          confirm("Delete this test game and all its at-bats? This can't be undone.")
        ) {
          startTransition(async () => {
            try {
              await deleteGame(gameId);
            } catch {
              toast.error("Couldn't delete game");
            }
          });
        }
      }}
    >
      {isPending ? "Deleting..." : "Delete test game"}
    </Button>
  );
}
