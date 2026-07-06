"use client";

import { useState, useTransition } from "react";
import { askStats } from "@/app/actions/askStats";
import { Button } from "@/components/ui/button";

const EXAMPLES = [
  "Who's been hot lately?",
  "Who leads the team in OPS?",
  "How did we do last game?",
];

export default function AskStatsBox() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || isPending) return;
    setQuestion(trimmed);
    setAnswer(null);
    startTransition(async () => {
      try {
        const { answer } = await askStats(trimmed);
        setAnswer(answer);
      } catch {
        setAnswer("Something went wrong — try again.");
      }
    });
  }

  return (
    <div className="mt-8 rounded-lg bg-card border border-border p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
        Ask about the season
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Who should bat cleanup?"
          maxLength={300}
          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
        <Button type="submit" size="sm" disabled={isPending || !question.trim()}>
          {isPending ? "Thinking…" : "Ask"}
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => ask(ex)}
            disabled={isPending}
            className="text-xs text-muted-foreground border border-border rounded-full px-2.5 py-1 hover:text-foreground hover:border-bk-teal/60 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {answer && (
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap border-t border-border pt-3">
          {answer}
        </p>
      )}
    </div>
  );
}
