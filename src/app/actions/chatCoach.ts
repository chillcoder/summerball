"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/posthog/server";
import { recommendLineup } from "@/lib/stats/lineup";
import type { Player, PlayerStats } from "@/types/database";

const MODEL = "claude-sonnet-4-6";
const INPUT_COST_PER_MTOK = 3.0;
const OUTPUT_COST_PER_MTOK = 15.0;
const TEAM_ID = process.env.NEXT_PUBLIC_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";
const MAX_TURNS = 16; // cap history sent to the model

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are the Beerkats' team coach and stats analyst — a recreational men's slow-pitch softball team. \
You help the recorder (Lucas) think about lineups, matchups, player performance, and trends.

Rules:
- Ground every claim in the DATA CONTEXT provided. If it can't answer, say so; never invent games, scores, or numbers.
- Be conversational but tight — a few sentences or a short list. Plain text, no markdown headers, no emoji.
- Batting metrics (AVG/OBP/SLG/OPS) are precomputed per player. AB excludes walks & sacrifices.
- For lineup advice: high-OBP hitters at the top to set the table, high-SLG in the middle to drive them in, weakest OPS at the bottom. A rule-based suggested order is provided — you can endorse, tweak, or explain it.
- "Lately"/"recent" = the last 2-3 games by date.`;

function buildContext(
  season: PlayerStats[],
  perGame: { player_id: string; played_at: string; ab: number; hits: number; home_runs: number; rbi: number }[],
  games: { played_at: string; opponent: string | null; final_score_us: number | null; final_score_them: number | null }[],
  suggested: string
): string {
  const nameById = new Map(season.map((p) => [p.player_id, p.player_name]));
  const seasonLines = season
    .sort((a, b) => b.ops - a.ops)
    .map(
      (p) =>
        `${p.player_name}: ${p.games_played}G ${p.ab}AB ${p.hits}H ${p.home_runs}HR ${p.rbi}RBI ` +
        `${p.walks}BB, AVG ${p.avg} OBP ${p.obp} SLG ${p.slg} OPS ${p.ops}`
    )
    .join("\n");
  const results = games
    .map(
      (g) =>
        `${g.played_at}${g.opponent ? ` vs ${g.opponent}` : ""}: ` +
        (g.final_score_us != null ? `${g.final_score_us}-${g.final_score_them}` : "no score")
    )
    .join("\n");
  const perGameLines = perGame
    .map((r) => `${r.played_at} ${nameById.get(r.player_id) ?? "?"}: ${r.hits}-${r.ab}${r.home_runs ? `, ${r.home_runs}HR` : ""}${r.rbi ? `, ${r.rbi}RBI` : ""}`)
    .join("\n");

  return `Today: ${new Date().toISOString().slice(0, 10)}

SEASON TOTALS (final games, sorted by OPS):
${seasonLines || "none yet"}

RULE-BASED SUGGESTED BATTING ORDER:
${suggested}

GAME RESULTS:
${results || "none yet"}

PER-GAME LINES (hits-AB):
${perGameLines || "none yet"}`;
}

export async function chatCoach(
  history: ChatMessage[]
): Promise<{ reply: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { reply: "Sign in to chat with the coach." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) {
    return { reply: "AI isn't configured yet (missing ANTHROPIC_API_KEY)." };
  }
  if (history.length === 0) return { reply: "Ask me anything about the team." };

  const [{ data: season }, { data: perGame }, { data: games }, { data: roster }] = await Promise.all([
    supabase.from("player_season_stats").select("*").eq("team_id", TEAM_ID),
    supabase
      .from("player_game_stats")
      .select("player_id, played_at, ab, hits, home_runs, rbi")
      .order("played_at", { ascending: true }),
    supabase
      .from("games")
      .select("played_at, opponent, final_score_us, final_score_them")
      .eq("team_id", TEAM_ID)
      .eq("status", "final")
      .eq("is_exhibition", false)
      .order("played_at", { ascending: true }),
    supabase.from("players").select("*").eq("team_id", TEAM_ID).eq("is_active", true).eq("is_guest", false),
  ]);

  const seasonStats = (season ?? []) as PlayerStats[];
  const statsMap = new Map(seasonStats.map((s) => [s.player_id, s]));
  const { entries } = recommendLineup((roster ?? []) as Player[], statsMap);
  const suggested = entries.map((e) => `${e.battingPosition}. ${e.player.name}`).join("\n");

  const context = buildContext(seasonStats, perGame ?? [], games ?? [], suggested);

  const messages: ChatMessage[] = history.slice(-MAX_TURNS);
  // Prepend the data context to the first user turn.
  const withContext = messages.map((m, i) =>
    i === 0 && m.role === "user"
      ? { role: m.role, content: `DATA CONTEXT:\n${context}\n\n---\n\n${m.content}` }
      : m
  );

  const client = new Anthropic({ apiKey });
  const start = Date.now();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: withContext,
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock && "text" in textBlock ? textBlock.text.trim() : "No reply.";

    const inputTokens = response.usage.input_tokens ?? 0;
    const outputTokens = response.usage.output_tokens ?? 0;
    await captureServer(user.id, "llm_coach_chat", {
      model: MODEL,
      latency_ms: Date.now() - start,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cost_usd: Number(
        ((inputTokens / 1_000_000) * INPUT_COST_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK).toFixed(6)
      ),
      turns: history.length,
    });
    return { reply };
  } catch (err) {
    await captureServer(user.id, "llm_coach_chat_failed", {
      model: MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    return { reply: "Couldn't reach the coach — try again in a minute." };
  }
}
