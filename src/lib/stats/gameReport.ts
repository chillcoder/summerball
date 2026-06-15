import type { AtBat } from "@/types/database";
import { computeStats, formatStat } from "./compute";

export interface PlayerLine {
  playerId: string;
  name: string;
  pa: number;
  ab: number;
  h: number;
  bb: number;
  sf: number;
  rbi: number;
  tb: number;
  b1: number;
  b2: number;
  b3: number;
  hr: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface TeamTotals {
  pa: number;
  ab: number;
  hits: number;
  walks: number;
  sacFlies: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  totalBases: number;
  rbi: number;
  runs: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface Leader {
  key: string;
  label: string;
  names: string[];
  value: string;
}

export interface GameReport {
  teamName: string;
  seasonLabel: string;
  opponent: string | null;
  dateLabel: string;
  finalScoreUs: number | null;
  finalScoreThem: number | null;
  result: "W" | "L" | "T" | null;
  teamTotals: TeamTotals;
  players: PlayerLine[];
  leaders: Leader[];
}

function totalBases(b1: number, b2: number, b3: number, hr: number) {
  return b1 + b2 * 2 + b3 * 3 + hr * 4;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function buildGameReport(
  players: { id: string; name: string }[],
  atBats: AtBat[],
  opts: {
    teamName: string;
    seasonLabel: string;
    opponent?: string | null;
    dateLabel: string;
    finalScoreUs?: number | null;
    finalScoreThem?: number | null;
  }
): GameReport {
  // Per-player lines, only players who had at least one plate appearance
  const lines: PlayerLine[] = [];

  for (const player of players) {
    const playerAbs = atBats.filter((ab) => ab.player_id === player.id);
    if (playerAbs.length === 0) continue;

    const s = computeStats(player.id, player.name, playerAbs);
    const tb = totalBases(s.singles, s.doubles, s.triples, s.home_runs);

    lines.push({
      playerId: player.id,
      name: player.name,
      pa: s.pa,
      ab: s.ab,
      h: s.hits,
      bb: s.walks,
      sf: s.sac,
      rbi: s.rbi,
      tb,
      b1: s.singles,
      b2: s.doubles,
      b3: s.triples,
      hr: s.home_runs,
      avg: s.avg,
      obp: s.obp,
      slg: s.slg,
      ops: s.ops,
    });
  }

  // Team totals — aggregate raw counts, then recompute rate stats from sums
  const sum = (fn: (l: PlayerLine) => number) => lines.reduce((a, l) => a + fn(l), 0);
  const ab = sum((l) => l.ab);
  const hits = sum((l) => l.h);
  const walks = sum((l) => l.bb);
  const sacFlies = sum((l) => l.sf);
  const singles = sum((l) => l.b1);
  const doubles = sum((l) => l.b2);
  const triples = sum((l) => l.b3);
  const homeRuns = sum((l) => l.hr);
  const tb = sum((l) => l.tb);

  const teamAvg = ab > 0 ? round3(hits / ab) : 0;
  const teamObp =
    ab + walks + sacFlies > 0
      ? round3((hits + walks) / (ab + walks + sacFlies))
      : 0;
  const teamSlg = ab > 0 ? round3(tb / ab) : 0;
  const teamOps = round3(teamObp + teamSlg);

  const teamTotals: TeamTotals = {
    pa: sum((l) => l.pa),
    ab,
    hits,
    walks,
    sacFlies,
    singles,
    doubles,
    triples,
    homeRuns,
    totalBases: tb,
    rbi: sum((l) => l.rbi),
    runs: opts.finalScoreUs ?? 0,
    avg: teamAvg,
    obp: teamObp,
    slg: teamSlg,
    ops: teamOps,
  };

  const leaders = computeLeaders(lines);

  let result: "W" | "L" | "T" | null = null;
  if (opts.finalScoreUs != null && opts.finalScoreThem != null) {
    result =
      opts.finalScoreUs > opts.finalScoreThem
        ? "W"
        : opts.finalScoreUs < opts.finalScoreThem
          ? "L"
          : "T";
  }

  return {
    teamName: opts.teamName,
    seasonLabel: opts.seasonLabel,
    opponent: opts.opponent ?? null,
    dateLabel: opts.dateLabel,
    finalScoreUs: opts.finalScoreUs ?? null,
    finalScoreThem: opts.finalScoreThem ?? null,
    result,
    teamTotals,
    players: lines,
    leaders,
  };
}

function computeLeaders(lines: PlayerLine[]): Leader[] {
  if (lines.length === 0) return [];

  // Counting-stat leader: max value, list all tied (value > 0)
  const countLeader = (
    key: string,
    label: string,
    fn: (l: PlayerLine) => number
  ): Leader => {
    const max = Math.max(...lines.map(fn));
    const names = lines.filter((l) => fn(l) === max && max > 0).map((l) => l.name);
    return { key, label, names, value: String(max) };
  };

  // Rate-stat leader: only players with at least 1 AB, max rate, tied names
  const rateLeader = (
    key: string,
    label: string,
    fn: (l: PlayerLine) => number,
    type: "avg" | "obp" | "slg" | "ops"
  ): Leader => {
    const eligible = lines.filter((l) => l.ab > 0);
    if (eligible.length === 0) return { key, label, names: [], value: "—" };
    const max = Math.max(...eligible.map(fn));
    const names = eligible.filter((l) => fn(l) === max).map((l) => l.name);
    return { key, label, names, value: formatStat(max, type) };
  };

  return [
    rateLeader("avg", "Batting Average", (l) => l.avg, "avg"),
    countLeader("hits", "Hits", (l) => l.h),
    countLeader("rbi", "RBI", (l) => l.rbi),
    countLeader("tb", "Total Bases", (l) => l.tb),
    countLeader("hr", "Home Runs", (l) => l.hr),
    countLeader("b2", "Doubles", (l) => l.b2),
    countLeader("b3", "Triples", (l) => l.b3),
    rateLeader("obp", "OBP", (l) => l.obp, "obp"),
    rateLeader("slg", "SLG", (l) => l.slg, "slg"),
    rateLeader("ops", "OPS", (l) => l.ops, "ops"),
  ];
}

/** Deterministic fallback recap — used if the Claude call fails. */
export function ruleBasedRecap(report: GameReport): string[] {
  const t = report.teamTotals;
  const bullets: string[] = [];

  bullets.push(`The ${report.teamName} had ${t.hits} hits in ${t.ab} at-bats.`);

  const rbiLeader = report.leaders.find((l) => l.key === "rbi");
  const tbLeader = report.leaders.find((l) => l.key === "tb");
  if (rbiLeader && rbiLeader.names.length > 0) {
    const top = report.players.find((p) => p.name === rbiLeader.names[0]);
    if (top) {
      bullets.push(
        `${top.name} led the way with ${top.rbi} RBI, ${top.tb} total bases, and a ${formatStat(top.ops, "ops")} OPS.`
      );
    }
  }

  const hitLeader = report.leaders.find((l) => l.key === "hits");
  if (hitLeader && hitLeader.names.length > 0) {
    const top = report.players.find((p) => p.name === hitLeader.names[0]);
    if (top && top.name !== rbiLeader?.names[0]) {
      bullets.push(
        `${top.name} had ${top.h} hits${top.hr > 0 ? ", a homer," : ""} and ${top.tb} total bases.`
      );
    }
  }

  const perfect = report.players.filter((p) => p.ab >= 1 && p.avg >= 1);
  if (perfect.length > 0) {
    bullets.push(
      `${joinNames(perfect.map((p) => p.name))} posted ${perfect.length === 1 ? "a perfect" : "perfect"} 1.000 batting average${perfect.length === 1 ? "" : "s"}.`
    );
  }

  bullets.push(
    `The team recorded ${t.doubles} double${t.doubles === 1 ? "" : "s"}, ${t.triples} triple${t.triples === 1 ? "" : "s"}, and ${t.homeRuns} home run${t.homeRuns === 1 ? "" : "s"}.`
  );

  return bullets.slice(0, 5);
}

export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
