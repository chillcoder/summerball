"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";
import type { GameReport } from "@/lib/stats/gameReport";
import { INFOGRAPHIC_WIDTH } from "./theme";
import GameRecapCard from "./GameRecapCard";
import PlayerBreakdownCard from "./PlayerBreakdownCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { regenerateRecap } from "@/app/actions/games";
import { toast } from "sonner";
import { posthog } from "@/lib/posthog/client";

type Tab = "recap" | "breakdown";

export default function InfographicClient({
  report,
  gameId,
  initialBullets,
  recapSource,
}: {
  report: GameReport;
  gameId: string;
  initialBullets: string[];
  recapSource: "ai" | "fallback" | "stored";
}) {
  const [tab, setTab] = useState<Tab>("recap");
  const [bullets, setBullets] = useState(initialBullets);
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);
  const scalerWrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number>(0);

  // Fit the 1040px card into the available width.
  const recompute = useCallback(() => {
    const wrap = scalerWrapRef.current;
    const card = captureRef.current;
    if (!wrap || !card) return;
    const available = wrap.clientWidth;
    const s = Math.min(1, available / INFOGRAPHIC_WIDTH);
    setScale(s);
    setScaledHeight(card.offsetHeight * s);
  }, []);

  useEffect(() => {
    recompute();
    const ro = new ResizeObserver(recompute);
    if (scalerWrapRef.current) ro.observe(scalerWrapRef.current);
    return () => ro.disconnect();
  }, [recompute, tab, bullets]);

  async function handleDownload() {
    const node = captureRef.current;
    if (!node) return;
    setDownloading(true);
    try {
      await document.fonts.ready;
      // Ensure the logo (and any images) are decoded before capture so
      // html-to-image embeds them rather than producing a blank box.
      await Promise.all(
        Array.from(node.querySelectorAll("img")).map((img) =>
          img.decode().catch(() => undefined)
        )
      );
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        width: INFOGRAPHIC_WIDTH,
        height: node.offsetHeight,
      });
      const link = document.createElement("a");
      const slug = report.teamName.toLowerCase().replace(/\s+/g, "-");
      link.download = `${slug}-${tab === "recap" ? "game-recap" : "player-breakdown"}.png`;
      link.href = dataUrl;
      link.click();
      posthog.capture("infographic_downloaded", { game_id: gameId, type: tab });
    } catch (err) {
      toast.error("Couldn't generate image");
    } finally {
      setDownloading(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const next = await regenerateRecap(gameId);
      setBullets(next);
      toast.success("Recap regenerated");
    } catch {
      toast.error("Couldn't regenerate recap");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("recap")}
          className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
            tab === "recap" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-400 border border-border"
          }`}
        >
          Game Recap
        </button>
        <button
          onClick={() => setTab("breakdown")}
          className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
            tab === "breakdown" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-400 border border-border"
          }`}
        >
          Player Breakdown
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {tab === "recap" && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {recapSource === "fallback" ? "Auto recap" : "AI recap"}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {tab === "recap" && (
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? "…" : "↻ Regenerate"}
            </Button>
          )}
          <Button size="sm" onClick={handleDownload} disabled={downloading} className="font-semibold">
            {downloading ? "Generating…" : "Download PNG"}
          </Button>
        </div>
      </div>

      {/* Scaled preview */}
      <div
        ref={scalerWrapRef}
        className="w-full overflow-hidden rounded-xl"
        style={{ height: scaledHeight || undefined }}
      >
        <div
          style={{
            width: INFOGRAPHIC_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div ref={captureRef}>
            {tab === "recap" ? (
              <GameRecapCard report={report} bullets={bullets} />
            ) : (
              <PlayerBreakdownCard report={report} />
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        High-resolution PNG · share to the team group chat
      </p>
    </div>
  );
}
