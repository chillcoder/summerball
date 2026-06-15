import type { Player, PlayerStats } from "@/types/database";

export interface LineupEntry {
  player: Player;
  stats: PlayerStats | null;
  battingPosition: number;
  explanation: string;
}

/**
 * Rule-based batting order recommendation.
 * Requires ≥3 games of data to produce a meaningful recommendation.
 * Falls back to alphabetical order otherwise.
 *
 * Rules:
 * - Spots 1–2: highest OBP (get on base for power hitters)
 * - Spots 3–5: highest SLG (drive in runs)
 * - Spots 6–8: remaining players by OPS desc
 * - Spots 9–end: lowest OPS (minimize outs in high-leverage late innings)
 */
export function recommendLineup(
  players: Player[],
  statsByPlayer: Map<string, PlayerStats>,
  minGames = 3
): { entries: LineupEntry[]; hasEnoughData: boolean } {
  const gamesPlayed = Math.max(
    ...[...statsByPlayer.values()].map((s) => s.games_played),
    0
  );

  if (gamesPlayed < minGames) {
    // Not enough data — return alphabetical order
    const entries = players
      .filter((p) => p.is_active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p, i) => ({
        player: p,
        stats: statsByPlayer.get(p.id) ?? null,
        battingPosition: i + 1,
        explanation: "Alphabetical order (need 3+ games for AI recommendation)",
      }));
    return { entries, hasEnoughData: false };
  }

  const withStats = players
    .filter((p) => p.is_active)
    .map((p) => ({ player: p, stats: statsByPlayer.get(p.id) ?? null }));

  // Sort functions
  const byOBPDesc = (
    a: { stats: PlayerStats | null },
    b: { stats: PlayerStats | null }
  ) => (b.stats?.obp ?? 0) - (a.stats?.obp ?? 0);
  const bySLGDesc = (
    a: { stats: PlayerStats | null },
    b: { stats: PlayerStats | null }
  ) => (b.stats?.slg ?? 0) - (a.stats?.slg ?? 0);
  const byOPSDesc = (
    a: { stats: PlayerStats | null },
    b: { stats: PlayerStats | null }
  ) => (b.stats?.ops ?? 0) - (a.stats?.ops ?? 0);
  const byOPSAsc = (
    a: { stats: PlayerStats | null },
    b: { stats: PlayerStats | null }
  ) => (a.stats?.ops ?? 0) - (b.stats?.ops ?? 0);

  const sorted = [...withStats].sort(byOBPDesc);
  const n = sorted.length;

  let top2 = sorted.slice(0, 2);
  let remaining = sorted.slice(2);

  // Spots 3-5: best SLG from remaining
  const powerHitters = [...remaining].sort(bySLGDesc).slice(0, 3);
  const powerIds = new Set(powerHitters.map((p) => p.player.id));
  remaining = remaining.filter((p) => !powerIds.has(p.player.id));

  // Spots 9+: weakest OPS goes last
  const bottom = [...remaining]
    .sort(byOPSAsc)
    .slice(0, Math.max(0, n - top2.length - powerHitters.length - Math.floor((remaining.length) / 2)));
  const bottomIds = new Set(bottom.map((p) => p.player.id));
  const middle = remaining.filter((p) => !bottomIds.has(p.player.id)).sort(byOPSDesc);

  const ordered = [...top2, ...powerHitters, ...middle, ...bottom];

  const entries: LineupEntry[] = ordered.map((entry, i) => {
    const pos = i + 1;
    const s = entry.stats;
    let explanation = "";

    if (pos <= 2) {
      explanation = s
        ? `Batting ${pos} — .${(s.obp * 1000).toFixed(0).padStart(3, "0")} OBP gets on base`
        : `Batting ${pos}`;
    } else if (pos <= 5) {
      explanation = s
        ? `Batting ${pos} — .${(s.slg * 1000).toFixed(0).padStart(3, "0")} SLG drives in runs`
        : `Batting ${pos}`;
    } else if (pos >= ordered.length - 1) {
      explanation = s
        ? `Batting ${pos} — .${(s.ops * 1000).toFixed(0).padStart(3, "0")} OPS`
        : `Batting ${pos}`;
    } else {
      explanation = s
        ? `Batting ${pos} — .${(s.ops * 1000).toFixed(0).padStart(3, "0")} OPS`
        : `Batting ${pos}`;
    }

    return {
      player: entry.player,
      stats: s,
      battingPosition: pos,
      explanation,
    };
  });

  return { entries, hasEnoughData: true };
}
