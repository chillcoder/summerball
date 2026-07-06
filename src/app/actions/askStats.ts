"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { captureServer } from "@/lib/posthog/server";
import type { PlayerStats } from "@/types/database";

// Same model/tier as the recap (PRD: "Sonnet for digests") — cheap, fast.
const MODEL = "claude-sonnet-4-6";
const INPUT_COST_PER_MTOK = 3.0;
const OUTPUT_COST_PER_MTOK = 15.0;

const TEAM_ID = process.env.NEXT_PUBLIC_TEAM_ID ?? "00000000-0000-0000-0000-000000000001";

const SYSTEM_PROMPT = `You are the stats assistant for the Beerkats, a recreational men's slow-pitch softball team. \
Answer questions using ONLY the season data provided. Rules:
- Be brief: 1-3 sentences, or a short ranked list when asked for comparisons. Plain text, no markdown headers.
- Ground every number in the data. If the data can't answer the question, say so plainly.
- AVG/OBP/SLG/OPS are already computed per player — don't recompute unless asked about a subset of games.
- "Lately" or "recent" means the most recent 2-3 games by date. No emoji.`;

interface GameRow {
  player_id: string;
  game_id: string;
  played_at: string;
  opponent: string | null;
  ab: number;
  hits: number;
  home_runs: number;
  walks: number;
  rbi: number;
  avg: number;
}

export async function askStats(question: string): Promise<{ answer: string }> {
  const q = question.trim().slice(0, 300);
  if (!q) return { answer: "Ask me something about the season." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { answer: "Sign in to ask stats questions." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) {
    return { answer: "AI isn't configured yet (missing ANTHROPIC_API_KEY)." };
  }

  // Compact season context: totals per player, per-game lines, team results.
  const [{ data: season }, { data: perGame }, { data: games }] = await Promise.all([
    supabase.from("player_season_stats").select("*").eq("team_id", TEAM_ID),
    supabase
      .from("player_game_stats")
      .select("player_id, game_id, played_at, opponent, ab, hits, home_runs, walks, rbi, avg")
      .order("played_at", { ascending: true }),
    supabase
      .from("games")
      .select("id, played_at, opponent, final_score_us, final_score_them")
      .eq("team_id", TEAM_ID)
      .eq("status", "final")
      .eq("is_exhibition", false)
      .order("played_at", { ascending: true }),
  ]);

  const nameById = new Map(
    ((season ?? []) as PlayerStats[]).map((p) => [p.player_id, p.player_name])
  );

  const seasonLines = ((season ?? []) as PlayerStats[])
    .map(
      (p) =>
        `${p.player_name}: ${p.games_played} G, ${p.ab} AB, ${p.hits} H, ` +
        `${p.home_runs} HR, ${p.rbi} RBI, ${p.walks} BB, AVG ${p.avg}, OBP ${p.obp}, SLG ${p.slg}, OPS ${p.ops}`
    )
    .join("\n");

  const gameResults = (games ?? [])
    .map(
      (g) =>
        `${g.played_at}${g.opponent ? ` vs ${g.opponent}` : ""}: ` +
        (g.final_score_us != null ? `${g.final_score_us}-${g.final_score_them}` : "no score")
    )
    .join("\n");

  const perGameLines = ((perGame ?? []) as GameRow[])
    .map(
      (r) =>
        `${r.played_at} ${nameById.get(r.player_id) ?? "?"}: ${r.hits}-${r.ab}` +
        `${r.home_runs ? `, ${r.home_runs} HR` : ""}${r.rbi ? `, ${r.rbi} RBI` : ""}${r.walks ? `, ${r.walks} BB` : ""}`
    )
    .join("\n");

  const context = `Today: ${new Date().toISOString().slice(0, 10)}

SEASON TOTALS (final games only):
${seasonLines || "none yet"}

GAME RESULTS:
${gameResults || "none yet"}

PER-GAME LINES (hits-AB):
${perGameLines || "none yet"}`;

  const client = new Anthropic({ apiKey });
  const start = Date.now();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: `${context}\n\nQUESTION: ${q}` }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const answer =
      textBlock && "text" in textBlock ? textBlock.text.trim() : "No answer generated.";

    const inputTokens = response.usage.input_tokens ?? 0;
    const outputTokens = response.usage.output_tokens ?? 0;
    await captureServer(user.id, "llm_stats_question", {
      model: MODEL,
      latency_ms: Date.now() - start,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cost_usd: Number(
        (
          (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
          (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK
        ).toFixed(6)
      ),
      question_length: q.length,
    });

    return { answer };
  } catch (err) {
    await captureServer(user.id, "llm_stats_question_failed", {
      model: MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    return { answer: "Couldn't reach the stats assistant — try again in a minute." };
  }
}
