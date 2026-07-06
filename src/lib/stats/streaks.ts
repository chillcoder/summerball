// Slump & streak detection. Pure rules, no LLM:
// - Hit streak: consecutive games (most recent backwards) with ≥1 hit.
//   Official-rules nuance: a game with 0 AB (all walks/sacs) doesn't break a
//   streak — it's skipped.
// - Hot: last-3-games AVG at least 150 points above season AVG.
// - Cold: last-3-games AVG at least 150 points below season AVG.
//   Both need ≥2 recent games and ≥6 AB so two lucky swings don't earn a flame.

export interface GameLine {
  hits: number;
  ab: number;
}

export type StreakStatus = "hot" | "cold" | null;

export interface StreakInfo {
  hitStreak: number;
  status: StreakStatus;
  last3Avg: number | null;
  last3Hits: number;
  last3Ab: number;
}

const HOT_COLD_DELTA = 0.15;
const MIN_RECENT_GAMES = 2;
const MIN_RECENT_AB = 6;

/** `gamesDesc` must be ordered most-recent first. */
export function computeStreaks(gamesDesc: GameLine[], seasonAvg: number): StreakInfo {
  let hitStreak = 0;
  for (const g of gamesDesc) {
    if (g.ab === 0) continue; // walk-only game: streak unaffected
    if (g.hits >= 1) hitStreak++;
    else break;
  }

  const recent = gamesDesc.filter((g) => g.ab > 0).slice(0, 3);
  const last3Hits = recent.reduce((s, g) => s + g.hits, 0);
  const last3Ab = recent.reduce((s, g) => s + g.ab, 0);
  const qualified = recent.length >= MIN_RECENT_GAMES && last3Ab >= MIN_RECENT_AB;
  const last3Avg = last3Ab > 0 ? last3Hits / last3Ab : null;

  let status: StreakStatus = null;
  if (qualified && last3Avg != null) {
    if (last3Avg >= seasonAvg + HOT_COLD_DELTA) status = "hot";
    else if (last3Avg <= seasonAvg - HOT_COLD_DELTA) status = "cold";
  }

  return { hitStreak, status, last3Avg, last3Hits, last3Ab };
}
