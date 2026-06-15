import type { AtBat, PlayerStats } from "@/types/database";

export function computeStats(
  playerId: string,
  playerName: string,
  atBats: AtBat[]
): PlayerStats {
  const finalized = atBats.filter((ab) => !ab.is_pending);

  const hits = finalized.filter((ab) =>
    ["1B", "2B", "3B", "HR"].includes(ab.outcome)
  );
  const singles = finalized.filter((ab) => ab.outcome === "1B").length;
  const doubles = finalized.filter((ab) => ab.outcome === "2B").length;
  const triples = finalized.filter((ab) => ab.outcome === "3B").length;
  const homeRuns = finalized.filter((ab) => ab.outcome === "HR").length;
  const walks = finalized.filter((ab) => ab.outcome === "BB").length;
  const sac = finalized.filter((ab) => ab.outcome === "SAC").length;
  const strikeouts = finalized.filter((ab) => ab.outcome === "K").length;
  const rbi = finalized.reduce((sum, ab) => sum + (ab.rbis ?? 0), 0);
  const runs = finalized.reduce((sum, ab) => sum + (ab.runs_scored ?? 0), 0);

  // Official AB excludes BB and SAC
  const ab = finalized.filter(
    (ab) => !["BB", "SAC"].includes(ab.outcome)
  ).length;
  const pa = finalized.length;
  const hitCount = hits.length;
  const totalBases = singles + doubles * 2 + triples * 3 + homeRuns * 4;
  const gamesPlayed = new Set(finalized.map((ab) => ab.game_id)).size;

  const avg = ab > 0 ? round3(hitCount / ab) : 0;
  const obp =
    ab + walks + sac > 0 ? round3((hitCount + walks) / (ab + walks + sac)) : 0;
  const slg = ab > 0 ? round3(totalBases / ab) : 0;
  const ops = round3(obp + slg);

  return {
    player_id: playerId,
    player_name: playerName,
    games_played: gamesPlayed,
    ab,
    pa,
    hits: hitCount,
    singles,
    doubles,
    triples,
    home_runs: homeRuns,
    walks,
    strikeouts,
    sac,
    rbi,
    runs,
    avg,
    obp,
    slg,
    ops,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function formatStat(val: number, type: "avg" | "obp" | "slg" | "ops") {
  if (type === "ops") {
    return val.toFixed(3);
  }
  // Classic baseball format: .333 (no leading zero)
  const str = val.toFixed(3);
  return val >= 1 ? str : str.slice(1); // remove leading 0 → ".333"
}
