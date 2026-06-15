// Verifies the stats engine reproduces the Beerkats reference infographic exactly.
// Run: node --experimental-strip-types scripts/verify-stats.mjs
// (or via: npm run verify:stats)
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Use tsx-style loader if available; otherwise this script expects pre-compiled.
// Simpler: re-implement the import via dynamic import of the TS through Next's transpile is overkill,
// so we inline-import using the project's tsconfig paths through a tiny shim.

const { sampleReport } = await import("../src/lib/stats/sampleGame.ts");

const EXPECTED_TEAM = {
  pa: 52, ab: 44, hits: 28, walks: 6, sacFlies: 2,
  singles: 17, doubles: 6, triples: 2, homeRuns: 3,
  totalBases: 47, rbi: 21,
  avg: 0.636, obp: 0.654, slg: 1.068, ops: 1.722,
};

const EXPECTED_PLAYERS = {
  Jake:   { ab: 4, h: 3, bb: 1, sf: 0, rbi: 5, tb: 8, avg: 0.75,  obp: 0.8,  slg: 2.0,  ops: 2.8 },
  Kevin:  { ab: 4, h: 2, bb: 1, sf: 0, rbi: 2, tb: 5, avg: 0.5,   obp: 0.6,  slg: 1.25, ops: 1.85 },
  Ben:    { ab: 5, h: 1, bb: 0, sf: 0, rbi: 0, tb: 2, avg: 0.2,   obp: 0.2,  slg: 0.4,  ops: 0.6 },
  Noah:   { ab: 5, h: 4, bb: 0, sf: 0, rbi: 1, tb: 8, avg: 0.8,   obp: 0.8,  slg: 1.6,  ops: 2.4 },
  Kyle:   { ab: 4, h: 4, bb: 0, sf: 1, rbi: 1, tb: 6, avg: 1.0,   obp: 0.8,  slg: 1.5,  ops: 2.3 },
  Sam:    { ab: 5, h: 3, bb: 0, sf: 0, rbi: 4, tb: 4, avg: 0.6,   obp: 0.6,  slg: 0.8,  ops: 1.4 },
  Diego:  { ab: 5, h: 3, bb: 0, sf: 0, rbi: 2, tb: 3, avg: 0.6,   obp: 0.6,  slg: 0.6,  ops: 1.2 },
  Austin: { ab: 3, h: 1, bb: 2, sf: 0, rbi: 1, tb: 3, avg: 0.333, obp: 0.6,  slg: 1.0,  ops: 1.6 },
  Matt:   { ab: 3, h: 2, bb: 1, sf: 0, rbi: 2, tb: 2, avg: 0.667, obp: 0.75, slg: 0.667, ops: 1.417 },
  Blake:  { ab: 4, h: 3, bb: 0, sf: 0, rbi: 2, tb: 4, avg: 0.75,  obp: 0.75, slg: 1.0,  ops: 1.75 },
  Lucas:  { ab: 2, h: 2, bb: 1, sf: 1, rbi: 1, tb: 2, avg: 1.0,   obp: 0.75, slg: 1.0,  ops: 1.75 },
};

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) {
    failures++;
    console.log(`  ✗ ${label}: got ${actual}, expected ${expected}`);
  }
  return ok;
}

const report = sampleReport();
const t = report.teamTotals;

console.log("TEAM TOTALS");
for (const [k, v] of Object.entries(EXPECTED_TEAM)) {
  check(`team.${k}`, t[k], v);
}

console.log("PER-PLAYER");
for (const [name, exp] of Object.entries(EXPECTED_PLAYERS)) {
  const p = report.players.find((x) => x.name === name);
  if (!p) { failures++; console.log(`  ✗ missing player ${name}`); continue; }
  for (const [k, v] of Object.entries(exp)) {
    check(`${name}.${k}`, p[k], v);
  }
}

console.log("LEADERS");
const leaderExpect = {
  avg: { names: ["Kyle", "Lucas"], value: "1.000" },
  hits: { names: ["Noah", "Kyle"], value: "4" },
  rbi: { names: ["Jake"], value: "5" },
  tb: { names: ["Jake", "Noah"], value: "8" },
  hr: { names: ["Jake", "Kevin", "Noah"], value: "1" },
  obp: { names: ["Jake", "Noah", "Kyle"], value: ".800" },
  slg: { names: ["Jake"], value: "2.000" },
  ops: { names: ["Jake"], value: "2.800" },
};
for (const [key, exp] of Object.entries(leaderExpect)) {
  const l = report.leaders.find((x) => x.key === key);
  const namesMatch = JSON.stringify([...l.names].sort()) === JSON.stringify([...exp.names].sort());
  check(`leader.${key}.value`, l.value, exp.value);
  if (!namesMatch) { failures++; console.log(`  ✗ leader.${key}.names: got [${l.names}], expected [${exp.names}]`); }
}

console.log("");
if (failures === 0) {
  console.log("✅ ALL CHECKS PASSED — engine matches the reference infographic exactly.");
  process.exit(0);
} else {
  console.log(`❌ ${failures} check(s) failed.`);
  process.exit(1);
}
