import type { AtBatOutcome, OutcomeCategory } from "@/types/database";

// Typed event definitions matching the PRD taxonomy
export type PostHogEvents = {
  app_opened: { device: string; is_returning: boolean };
  game_started: {
    game_id: string;
    lineup_mode: string;
    player_count: number;
  };
  at_bat_recorded: {
    game_id: string;
    player_id: string;
    outcome: AtBatOutcome;
    category: OutcomeCategory;
    time_step1_to_step2_ms: number;
    time_since_last_ab_ms: number | null;
    was_self_ab: boolean;
  };
  at_bat_category_changed: {
    game_id: string;
    from_category: OutcomeCategory;
    to_category: OutcomeCategory;
  };
  at_bat_undone: { at_bat_id: string; time_to_undo_ms: number };
  at_bat_edited: {
    at_bat_id: string;
    from_outcome: AtBatOutcome;
    to_outcome: AtBatOutcome;
    source: "live" | "post_game";
  };
  batter_skipped: {
    game_id: string;
    player_id: string;
    reason: string;
  };
  recording_handed_off: {
    from_user: string;
    to_user: string | null;
    game_id: string;
  };
  self_ab_mode_chosen: { mode: "handoff" | "voice" | "pending" };
  pending_at_bat_resolved: {
    at_bat_id: string;
    resolved_via: string;
    time_since_created_ms: number;
  };
  game_ended: {
    game_id: string;
    duration_min: number;
    total_at_bats: number;
    final_score: string | null;
  };
  stats_viewed: { scope: "team" | "player"; viewer_role: string };
  lineup_recommendation_viewed: {
    game_id: string;
    recommended_order: string[];
    accepted: boolean;
  };
  digest_sent: { recipient_count: number; week: string };
  digest_link_clicked: { recipient: string; week: string };
};

export type PostHogEventName = keyof PostHogEvents;
