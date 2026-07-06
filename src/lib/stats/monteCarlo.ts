import type { AtBatOutcome } from "@/types/database";

/**
 * Monte Carlo lineup optimizer.
 *
 * Each player's plate-appearance outcome distribution comes from their real
 * season at-bats, shrunk toward the team's overall rates so small samples
 * (guests, 1-game players) don't produce absurd orders. Games are simulated
 * with a deliberately simple, deterministic base-running model — runners
 * advance exactly the hit's bases — which biases all lineups equally, and
 * ranking lineups (not predicting absolute runs) is the goal.
 *
 * Variance reduction: every candidate lineup is evaluated with the same seeded
 * RNG (common random numbers), so comparisons are stable and the hill-climb
 * doesn't chase noise. Results are reproducible for a given roster.
 */

export interface PlayerDist {
  playerId: string;
  name: string;
  pa: number; // real plate appearances backing this distribution
  // cumulative distribution over outcomes, ascending
  cdf: { outcome: AtBatOutcome; upTo: number }[];
}

const ALL_OUTCOMES: AtBatOutcome[] = [
  "1B", "2B", "3B", "HR", "BB", "K",
  "groundout", "flyout", "lineout", "FC", "ROE", "SAC",
];

// How strongly small samples get pulled toward team-average rates (in PA).
const SHRINKAGE_PA = 10;

export type OutcomeCounts = Partial<Record<AtBatOutcome, number>>;

export function buildDistributions(
  countsByPlayer: Record<string, OutcomeCounts>,
  players: { playerId: string; name: string }[]
): PlayerDist[] {
  // Team-wide rates as the prior.
  const teamCounts: Record<AtBatOutcome, number> = Object.fromEntries(
    ALL_OUTCOMES.map((o) => [o, 0])
  ) as Record<AtBatOutcome, number>;
  let teamPa = 0;
  for (const counts of Object.values(countsByPlayer)) {
    for (const o of ALL_OUTCOMES) {
      teamCounts[o] += counts[o] ?? 0;
      teamPa += counts[o] ?? 0;
    }
  }
  // Cold-start prior if the season is empty: modest league-ish slow-pitch rates.
  const priorRates: Record<AtBatOutcome, number> =
    teamPa > 0
      ? (Object.fromEntries(
          ALL_OUTCOMES.map((o) => [o, teamCounts[o] / teamPa])
        ) as Record<AtBatOutcome, number>)
      : {
          "1B": 0.32, "2B": 0.1, "3B": 0.02, HR: 0.03, BB: 0.08, K: 0.05,
          groundout: 0.2, flyout: 0.14, lineout: 0.03, FC: 0.01, ROE: 0.01, SAC: 0.01,
        };

  return players.map(({ playerId, name }) => {
    const counts = countsByPlayer[playerId] ?? {};
    const pa = ALL_OUTCOMES.reduce((s, o) => s + (counts[o] ?? 0), 0);
    const cdf: PlayerDist["cdf"] = [];
    let acc = 0;
    for (const o of ALL_OUTCOMES) {
      const p = ((counts[o] ?? 0) + SHRINKAGE_PA * priorRates[o]) / (pa + SHRINKAGE_PA);
      acc += p;
      cdf.push({ outcome: o, upTo: acc });
    }
    // Normalize the tail to exactly 1 (float drift).
    cdf[cdf.length - 1].upTo = 1;
    return { playerId, name, pa, cdf };
  });
}

// Deterministic RNG (mulberry32) for reproducible, comparable evaluations.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draw(dist: PlayerDist, r: number): AtBatOutcome {
  for (const { outcome, upTo } of dist.cdf) {
    if (r < upTo) return outcome;
  }
  return "groundout";
}

/** Mean runs per game for a batting order, over `nGames` simulated 7-inning games. */
export function simulateLineup(order: PlayerDist[], nGames: number, seed = 42): number {
  if (order.length === 0) return 0;
  const rng = mulberry32(seed);
  let totalRuns = 0;

  for (let g = 0; g < nGames; g++) {
    let batter = 0; // continuous order carries across innings
    for (let inning = 0; inning < 7; inning++) {
      let outs = 0;
      // bases[0]=1st, [1]=2nd, [2]=3rd
      const bases: boolean[] = [false, false, false];

      const advance = (n: number, includeBatter: boolean) => {
        let runs = 0;
        for (let b = 2; b >= 0; b--) {
          if (!bases[b]) continue;
          bases[b] = false;
          if (b + n >= 3) runs++;
          else bases[b + n] = true;
        }
        if (includeBatter) {
          if (n >= 4) runs++;
          else bases[n - 1] = true;
        }
        return runs;
      };

      while (outs < 3) {
        const out = draw(order[batter % order.length], rng());
        batter++;
        switch (out) {
          case "K":
          case "groundout":
          case "flyout":
          case "lineout":
            outs++;
            break;
          case "SAC": {
            outs++;
            if (outs < 3) totalRuns += advance(1, false);
            break;
          }
          case "FC": {
            // Lead runner out, batter safe at first; bases empty → plain out.
            const lead = bases.lastIndexOf(true);
            if (lead >= 0) {
              bases[lead] = false;
              outs++;
              if (outs < 3) bases[0] = true;
            } else {
              outs++;
            }
            break;
          }
          case "BB": {
            // Force advances only.
            if (bases[0] && bases[1] && bases[2]) totalRuns += 1;
            else if (bases[0] && bases[1]) bases[2] = true;
            else if (bases[0]) bases[1] = true;
            bases[0] = true;
            break;
          }
          case "ROE":
          case "1B":
            totalRuns += advance(1, true);
            break;
          case "2B":
            totalRuns += advance(2, true);
            break;
          case "3B":
            totalRuns += advance(3, true);
            break;
          case "HR":
            totalRuns += advance(4, true);
            break;
        }
      }
    }
  }

  return totalRuns / nGames;
}

export interface OptimizeResult {
  order: PlayerDist[];
  runsPerGame: number;
  baselineRunsPerGame: number; // the order we started from, at the same fidelity
}

/**
 * Hill-climb from `seedOrder`: propose random position swaps, keep improvements.
 * Cheap evaluations during the climb, one high-fidelity pass at the end.
 */
export function optimizeLineup(
  seedOrder: PlayerDist[],
  opts: { iterations?: number; evalGames?: number; finalGames?: number } = {}
): OptimizeResult {
  const { iterations = 80, evalGames = 300, finalGames = 1500 } = opts;
  if (seedOrder.length < 2) {
    const r = simulateLineup(seedOrder, finalGames);
    return { order: seedOrder, runsPerGame: r, baselineRunsPerGame: r };
  }

  const rng = mulberry32(1337);
  let best = [...seedOrder];
  let bestScore = simulateLineup(best, evalGames);

  for (let i = 0; i < iterations; i++) {
    const a = Math.floor(rng() * best.length);
    let b = Math.floor(rng() * best.length);
    if (a === b) b = (b + 1) % best.length;
    const candidate = [...best];
    [candidate[a], candidate[b]] = [candidate[b], candidate[a]];
    const score = simulateLineup(candidate, evalGames);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return {
    order: best,
    runsPerGame: simulateLineup(best, finalGames),
    baselineRunsPerGame: simulateLineup(seedOrder, finalGames),
  };
}
