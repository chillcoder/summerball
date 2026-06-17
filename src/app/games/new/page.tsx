"use client";

import { createGame } from "@/app/actions/games";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function NewGamePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isTest, setIsTest] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  // Pre-check "test game" when arriving from the home-screen shortcut.
  useEffect(() => {
    setIsTest(new URLSearchParams(window.location.search).get("test") === "1");
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const { gameId } = await createGame(formData);
        router.push(`/games/${gameId}/lineup`);
      } catch {
        toast.error("Couldn't create the game. Make sure you're signed in.");
      }
    });
  }

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto">
      <Link href="/" className="text-sm text-muted-foreground mb-6 block">← Back</Link>
      <h1 className="text-2xl font-bold mb-6">{isTest ? "New Test Game" : "New Game"}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Opponent (optional)</label>
          <input
            name="opponent"
            type="text"
            placeholder="Team name"
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Date</label>
          <input
            name="played_at"
            type="date"
            defaultValue={today}
            className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Lineup Mode</label>
          <div className="grid grid-cols-2 gap-3">
            <label className="relative">
              <input type="radio" name="lineup_mode" value="continuous" defaultChecked className="sr-only peer" />
              <div className="p-4 rounded-lg border border-border peer-checked:border-zinc-400 peer-checked:bg-zinc-800 cursor-pointer text-center transition-colors">
                <p className="font-medium">Continuous</p>
                <p className="text-xs text-muted-foreground mt-1">Batting order cycles through the game</p>
              </div>
            </label>
            <label className="relative">
              <input type="radio" name="lineup_mode" value="fixed" className="sr-only peer" />
              <div className="p-4 rounded-lg border border-border peer-checked:border-zinc-400 peer-checked:bg-zinc-800 cursor-pointer text-center transition-colors">
                <p className="font-medium">Fixed</p>
                <p className="text-xs text-muted-foreground mt-1">Set batting order per inning</p>
              </div>
            </label>
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer">
          <input
            type="checkbox"
            name="is_exhibition"
            value="true"
            checked={isTest}
            onChange={(e) => setIsTest(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-amber-500"
          />
          <span>
            <span className="font-medium text-sm">Test game</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Practice the recording flow — won&apos;t count toward season stats.
            </span>
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full font-bold mt-4" disabled={isPending}>
          {isPending ? "Creating..." : "Set Lineup →"}
        </Button>
      </form>
    </main>
  );
}
