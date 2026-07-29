"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { chatCoach, type ChatMessage } from "@/app/actions/chatCoach";
import { Button } from "@/components/ui/button";

const STARTERS = [
  "What's our best batting order right now?",
  "Who should bat cleanup and why?",
  "Who's trending up over the last few games?",
  "Which hitters are struggling?",
];

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    startTransition(async () => {
      try {
        const { reply } = await chatCoach(next);
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      } catch {
        setMessages((m) => [...m, { role: "assistant", content: "Something went wrong — try again." }]);
      }
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Ask about lineups, matchups, who&apos;s hot, or anything in the season stats.
            </p>
            <div className="flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm text-foreground border border-border rounded-lg px-3 py-2 hover:border-bk-teal/60 hover:bg-card transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-gold text-ink rounded-br-md"
                  : "bg-card border border-border text-foreground rounded-bl-md"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 pt-2 border-t border-border pb-safe"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the coach…"
          maxLength={500}
          className="flex-1 px-3 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
        <Button type="submit" disabled={isPending || !input.trim()} className="font-medium">
          Send
        </Button>
      </form>
    </div>
  );
}
