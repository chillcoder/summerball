"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GLOSSARY } from "@/lib/glossary";

/**
 * Quick terminology reference. Pure overlay — opening and closing never
 * navigates, so the user's spot (mid-recording included) is preserved.
 * Renders its own "?" trigger button.
 */
export default function GlossarySheet({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="What do these terms mean?"
        className={`w-6 h-6 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-bk-teal/60 text-xs font-medium transition-colors ${className}`}
      >
        ?
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[85vh] bg-background border-border"
        >
          <SheetHeader className="flex-row items-center justify-between">
            <SheetTitle className="text-foreground">What the terms mean</SheetTitle>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card text-lg leading-none"
            >
              ✕
            </button>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto mt-2 pb-4 px-1 space-y-6">
            {GLOSSARY.map((section) => (
              <div key={section.title}>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {section.title}
                </p>
                <div className="space-y-1.5">
                  {section.terms.map((t) => (
                    <div
                      key={t.term}
                      className="flex gap-3 p-2.5 rounded-lg bg-card border border-border"
                    >
                      <span className="shrink-0 w-11 text-center self-start mt-0.5 text-xs font-bold font-mono text-gold bg-gold/10 border border-gold/30 rounded px-1 py-0.5">
                        {t.term}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.def}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="shrink-0 w-full py-3 rounded-xl bg-card border border-border text-foreground font-medium active:scale-98 transition-transform"
          >
            Done
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
