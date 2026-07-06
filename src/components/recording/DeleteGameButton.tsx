"use client";

import { useTransition } from "react";
import { deleteGame } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DeleteGameButton({
  gameId,
  label = "Delete game",
  confirmText = "Delete this game and all its at-bats? This can't be undone.",
  className = "w-full",
  size,
}: {
  gameId: string;
  label?: string;
  confirmText?: string;
  className?: string;
  size?: "sm" | "lg" | "default" | "icon";
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size={size}
      className={`text-red-400 hover:text-red-300 hover:bg-red-900/20 ${className}`}
      disabled={isPending}
      onClick={() => {
        if (confirm(confirmText)) {
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
      {isPending ? "Deleting..." : label}
    </Button>
  );
}
