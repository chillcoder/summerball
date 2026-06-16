export type LineupMode = "continuous" | "fixed";
export type GameStatus = "scheduled" | "live" | "final";
export type PlayerLineupStatus = "played" | "dnp" | "bench";
export type TeamMemberRole = "owner" | "recorder" | "viewer";

export type AtBatOutcome =
  | "1B"
  | "2B"
  | "3B"
  | "HR"
  | "BB"
  | "K"
  | "groundout"
  | "flyout"
  | "lineout"
  | "FC"
  | "ROE"
  | "SAC";

export type OutcomeCategory = "hit" | "out" | "other";

export const OUTCOME_CATEGORIES: Record<AtBatOutcome, OutcomeCategory> = {
  "1B": "hit",
  "2B": "hit",
  "3B": "hit",
  HR: "hit",
  K: "out",
  groundout: "out",
  flyout: "out",
  lineout: "out",
  BB: "other",
  FC: "other",
  ROE: "other",
  SAC: "other",
};

export const OUTCOMES_BY_CATEGORY: Record<OutcomeCategory, AtBatOutcome[]> = {
  hit: ["1B", "2B", "3B", "HR"],
  out: ["K", "groundout", "flyout", "lineout"],
  other: ["BB", "FC", "ROE", "SAC"],
};

export const OUTCOME_LABELS: Record<AtBatOutcome, string> = {
  "1B": "Single",
  "2B": "Double",
  "3B": "Triple",
  HR: "Home Run",
  K: "Strikeout",
  groundout: "Groundout",
  flyout: "Pop/Fly Out",
  lineout: "Lineout",
  BB: "Walk",
  FC: "Fielder's Choice",
  ROE: "Reach on Error",
  SAC: "Sacrifice",
};

// Supabase DB types (matches generated schema)
export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  is_active: boolean;
  is_guest: boolean;
  joined_at: string;
}

export interface Game {
  id: string;
  team_id: string;
  played_at: string;
  opponent: string | null;
  lineup_mode: LineupMode;
  final_score_us: number | null;
  final_score_them: number | null;
  status: GameStatus;
  notes: string | null;
  is_exhibition: boolean;
}

export interface GameLineup {
  id: string;
  game_id: string;
  player_id: string;
  batting_position: number | null;
  status: PlayerLineupStatus;
}

export interface AtBat {
  id: string;
  game_id: string;
  player_id: string;
  sequence_in_game: number;
  outcome: AtBatOutcome;
  rbis: number;
  runs_scored: number;
  recorded_by_user_id: string | null;
  recorded_at: string;
  is_pending: boolean;
  was_self_ab: boolean;
}

export interface TeamMember {
  user_id: string;
  team_id: string;
  role: TeamMemberRole;
  invited_at: string;
}

// Computed stats
export interface PlayerStats {
  player_id: string;
  player_name: string;
  games_played: number;
  ab: number; // plate appearances minus BB and SAC
  pa: number; // total plate appearances
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  home_runs: number;
  walks: number;
  strikeouts: number;
  sac: number;
  rbi: number;
  runs: number;
  avg: number; // hits / ab
  obp: number; // (hits + bb) / (ab + bb + sac)
  slg: number; // total bases / ab
  ops: number; // obp + slg
}

export interface GameWithStats {
  game: Game;
  at_bats: AtBat[];
  lineup: (GameLineup & { player: Player })[];
}
