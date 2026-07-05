"use client";

import { useState } from "react";
import type { PlayerStats } from "@/types/database";
import { formatStat } from "@/lib/stats/compute";
import Link from "next/link";
import { posthog } from "@/lib/posthog/client";

type SortKey = "avg" | "obp" | "slg" | "ops" | "hits" | "home_runs";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "avg", label: "AVG" },
  { key: "obp", label: "OBP" },
  { key: "slg", label: "SLG" },
  { key: "ops", label: "OPS" },
  { key: "hits", label: "H" },
  { key: "home_runs", label: "HR" },
];

export default function TeamStatsClient({ stats }: { stats: PlayerStats[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("avg");

  const sorted = [...stats].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));

  function handleSort(key: SortKey) {
    setSortKey(key);
    posthog.capture("stats_viewed", { scope: "team", viewer_role: "viewer" });
  }

  if (stats.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No stats yet</p>
        <p className="text-sm mt-1">Stats appear after the first game is finalized</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Player</th>
            <th className="text-center py-2 px-1 text-muted-foreground font-medium text-xs">G</th>
            <th className="text-center py-2 px-1 text-muted-foreground font-medium text-xs">AB</th>
            {COLUMNS.map(({ key, label }) => (
              <th
                key={key}
                className={`text-center py-2 px-2 font-medium text-xs cursor-pointer transition-colors ${
                  sortKey === key ? "text-cream" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => handleSort(key)}
              >
                {label}
                {sortKey === key && <span className="ml-0.5">↓</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <tr
              key={p.player_id}
              className="border-b border-border/50 hover:bg-card/50 transition-colors"
            >
              <td className="py-3 pr-4">
                <Link
                  href={`/player/${p.player_id}`}
                  className="font-medium hover:text-cream transition-colors"
                  onClick={() => posthog.capture("stats_viewed", { scope: "player", viewer_role: "viewer" })}
                >
                  {p.player_name}
                </Link>
              </td>
              <td className="text-center py-3 px-1 text-muted-foreground">{p.games_played}</td>
              <td className="text-center py-3 px-1 text-muted-foreground">{p.ab}</td>
              <td className={`text-center py-3 px-2 font-mono text-sm ${sortKey === "avg" ? "text-cream font-semibold" : ""}`}>
                {formatStat(p.avg, "avg")}
              </td>
              <td className={`text-center py-3 px-2 font-mono text-sm ${sortKey === "obp" ? "text-cream font-semibold" : ""}`}>
                {formatStat(p.obp, "obp")}
              </td>
              <td className={`text-center py-3 px-2 font-mono text-sm ${sortKey === "slg" ? "text-cream font-semibold" : ""}`}>
                {formatStat(p.slg, "slg")}
              </td>
              <td className={`text-center py-3 px-2 font-mono text-sm ${sortKey === "ops" ? "text-cream font-semibold" : ""}`}>
                {formatStat(p.ops, "ops")}
              </td>
              <td className={`text-center py-3 px-2 ${sortKey === "hits" ? "text-cream font-semibold" : "text-muted-foreground"}`}>
                {p.hits}
              </td>
              <td className={`text-center py-3 px-2 ${sortKey === "home_runs" ? "text-cream font-semibold" : "text-muted-foreground"}`}>
                {p.home_runs}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
