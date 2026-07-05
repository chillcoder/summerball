// Terminology reference shown in the GlossarySheet overlay. Definitions state
// the rules THIS app actually uses (mirrors src/lib/stats/compute.ts and the
// Postgres stat views), not just generic baseball definitions.

export interface GlossaryTerm {
  term: string;
  name: string;
  def: string;
}

export interface GlossarySection {
  title: string;
  terms: GlossaryTerm[];
}

export const GLOSSARY: GlossarySection[] = [
  {
    title: "Hits",
    terms: [
      { term: "1B", name: "Single", def: "Batter reaches first base on a hit. Counts as a hit and an at-bat." },
      { term: "2B", name: "Double", def: "Batter reaches second base on a hit." },
      { term: "3B", name: "Triple", def: "Batter reaches third base on a hit." },
      { term: "HR", name: "Home Run", def: "Batter rounds all bases and scores. Automatically records 1 RBI (the batter drives himself in) — tap + for each runner who also scored." },
    ],
  },
  {
    title: "Outs",
    terms: [
      { term: "K", name: "Strikeout", def: "Out on strikes. Counts as an at-bat with no hit." },
      { term: "GO", name: "Groundout", def: "Ball hit on the ground, fielded for an out." },
      { term: "FO", name: "Pop/Fly Out", def: "Ball hit in the air and caught." },
      { term: "LO", name: "Lineout", def: "Line drive caught for an out." },
    ],
  },
  {
    title: "Other outcomes",
    terms: [
      { term: "BB", name: "Walk (Base on Balls)", def: "Batter takes four balls and gets first base. NOT an at-bat — doesn't hurt your average, but does help your OBP." },
      { term: "FC", name: "Fielder's Choice", def: "Batter reaches base, but only because the defense chose to put out a different runner. Counts as an at-bat, not a hit." },
      { term: "ROE", name: "Reached on Error", def: "Batter reaches base because the defense misplayed the ball. Counts as an at-bat, not a hit." },
      { term: "SAC", name: "Sacrifice", def: "Sac fly or bunt that intentionally trades an out for a run or advance. NOT an at-bat (protects your average) but counts against OBP. A sac fly scores a runner by definition, so it auto-records 1 RBI." },
    ],
  },
  {
    title: "Stats",
    terms: [
      { term: "PA", name: "Plate Appearances", def: "Every completed trip to the plate, no matter the outcome." },
      { term: "AB", name: "At-Bats", def: "Plate appearances minus walks and sacrifices. The denominator for AVG and SLG." },
      { term: "H", name: "Hits", def: "Singles + doubles + triples + home runs." },
      { term: "RBI", name: "Runs Batted In", def: "Runners (including yourself on a HR) who scored because of your at-bat. Recorded with the stepper on the last-play bar, or in the finalize screen." },
      { term: "AVG", name: "Batting Average", def: "Hits ÷ at-bats. Walks and sacrifices don't count against it." },
      { term: "OBP", name: "On-Base Percentage", def: "(Hits + walks) ÷ (at-bats + walks + sacrifices). How often you reach base — walks help, sacrifices count against." },
      { term: "SLG", name: "Slugging", def: "Total bases ÷ at-bats. A single is 1 base, double 2, triple 3, HR 4 — measures power." },
      { term: "OPS", name: "On-Base Plus Slugging", def: "OBP + SLG. The one number that best captures overall hitting." },
    ],
  },
  {
    title: "App terms",
    terms: [
      { term: "DNP", name: "Did Not Play", def: "Marked on the lineup screen for roster players sitting out this game. They keep their season stats." },
      { term: "Pending", name: "Pending at-bat", def: "An at-bat saved without an outcome yet (usually your own, via \"fill in after\"). Excluded from all stats until you resolve it from the Edit Log." },
      { term: "Test", name: "Test game", def: "A practice game for trying the app. Never counts toward season stats and can be deleted." },
    ],
  },
];
