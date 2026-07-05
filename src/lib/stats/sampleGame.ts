import type { AtBat, AtBatOutcome } from "@/types/database";
import { buildGameReport, type GameReport } from "./gameReport";

/**
 * The exact game from the Beerkats reference infographic, encoded as raw
 * outcomes + RBIs so we can verify the engine reproduces every published number
 * (.636 AVG / .654 OBP / 1.068 SLG / 1.722 OPS) and so the demo route has real
 * data to render without touching the database.
 */
type RawLine = { name: string; outcomes: AtBatOutcome[]; rbis: number[] };

export const SAMPLE_PLAYERS: { id: string; name: string }[] = [
  { id: "p-jake", name: "Jake" },
  { id: "p-kevin", name: "Kevin" },
  { id: "p-ben", name: "Ben" },
  { id: "p-noah", name: "Noah" },
  { id: "p-kyle", name: "Kyle" },
  { id: "p-sam", name: "Sam" },
  { id: "p-diego", name: "Diego" },
  { id: "p-austin", name: "Austin" },
  { id: "p-matt", name: "Matt" },
  { id: "p-blake", name: "Blake" },
  { id: "p-lucas", name: "Lucas" },
];

const RAW: Record<string, RawLine> = {
  "p-jake": { name: "Jake", outcomes: ["1B", "3B", "HR", "groundout", "BB"], rbis: [1, 1, 3, 0, 0] },
  "p-kevin": { name: "Kevin", outcomes: ["1B", "HR", "groundout", "flyout", "BB"], rbis: [0, 2, 0, 0, 0] },
  "p-ben": { name: "Ben", outcomes: ["2B", "K", "groundout", "flyout", "lineout"], rbis: [0, 0, 0, 0, 0] },
  "p-noah": { name: "Noah", outcomes: ["1B", "1B", "2B", "HR", "groundout"], rbis: [0, 0, 0, 1, 0] },
  "p-kyle": { name: "Kyle", outcomes: ["1B", "1B", "2B", "2B", "SAC"], rbis: [0, 0, 0, 0, 1] },
  "p-sam": { name: "Sam", outcomes: ["1B", "1B", "2B", "groundout", "flyout"], rbis: [1, 1, 2, 0, 0] },
  "p-diego": { name: "Diego", outcomes: ["1B", "1B", "1B", "groundout", "flyout"], rbis: [1, 1, 0, 0, 0] },
  "p-austin": { name: "Austin", outcomes: ["3B", "groundout", "flyout", "BB", "BB"], rbis: [1, 0, 0, 0, 0] },
  "p-matt": { name: "Matt", outcomes: ["1B", "1B", "groundout", "BB"], rbis: [1, 1, 0, 0] },
  "p-blake": { name: "Blake", outcomes: ["1B", "1B", "2B", "groundout"], rbis: [1, 1, 0, 0] },
  "p-lucas": { name: "Lucas", outcomes: ["1B", "1B", "BB", "SAC"], rbis: [0, 0, 0, 1] },
};

export function sampleAtBats(): AtBat[] {
  const atBats: AtBat[] = [];
  let seq = 1;
  for (const player of SAMPLE_PLAYERS) {
    const line = RAW[player.id];
    line.outcomes.forEach((outcome, i) => {
      atBats.push({
        id: `${player.id}-${i}`,
        game_id: "sample-game",
        player_id: player.id,
        sequence_in_game: seq++,
        inning: 1,
        outcome,
        rbis: line.rbis[i] ?? 0,
        runs_scored: 0,
        recorded_by_user_id: null,
        recorded_at: new Date().toISOString(),
        is_pending: false,
        was_self_ab: false,
      });
    });
  }
  return atBats;
}

export function sampleReport(): GameReport {
  return buildGameReport(SAMPLE_PLAYERS, sampleAtBats(), {
    teamName: "Beerkats",
    seasonLabel: "Summer Ball 2026",
    opponent: "Sharks",
    dateLabel: "June 14, 2026",
    finalScoreUs: 14,
    finalScoreThem: 9,
  });
}
