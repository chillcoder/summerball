import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { GameReport } from "@/lib/stats/gameReport";
import { ruleBasedRecap } from "@/lib/stats/gameReport";
import { captureServer } from "@/lib/posthog/server";

// Per the PRD stack ("Sonnet for digests"), the post-game recap runs on Sonnet 4.6:
// cheap, fast, and the documented model for this digest-style workload.
const MODEL = "claude-sonnet-4-6";

// Sonnet 4.6 pricing ($/1M tokens) for cost instrumentation.
const INPUT_COST_PER_MTOK = 3.0;
const OUTPUT_COST_PER_MTOK = 15.0;

const SYSTEM_PROMPT = `You are a sports recap writer for a recreational men's slow-pitch softball team. \
Given one game's batting box score, write a short, punchy "Quick Recap" of 4-5 bullet points for a game infographic. \
Rules:
- Each bullet is one factual sentence grounded ONLY in the provided stats. Never invent plays, innings, or details not in the data.
- Lead with the team line (hits/at-bats), then highlight 2-3 standout hitters by name, then a closing note on extra-base hits.
- Keep each bullet under ~16 words. Confident, fun, but factual. No emoji.
- Use the team name provided.`;

interface RecapResult {
  bullets: string[];
  source: "ai" | "fallback";
}

function buildUserPrompt(report: GameReport): string {
  const t = report.teamTotals;
  const lines = report.players
    .map(
      (p) =>
        `${p.name}: ${p.h}-for-${p.ab}, ${p.bb} BB, ${p.rbi} RBI, ${p.tb} TB, ` +
        `${p.b1}/${p.b2}/${p.b3}/${p.hr} (1B/2B/3B/HR), AVG ${p.avg.toFixed(3)}, OPS ${p.ops.toFixed(3)}`
    )
    .join("\n");

  return `Team: ${report.teamName}${report.opponent ? ` vs ${report.opponent}` : ""}
Final score: ${report.finalScoreUs ?? "?"}-${report.finalScoreThem ?? "?"}

TEAM TOTALS: ${t.hits} hits, ${t.ab} AB, ${t.walks} BB, ${t.sacFlies} SF, ${t.rbi} RBI, ${t.totalBases} TB, ${t.singles} 1B, ${t.doubles} 2B, ${t.triples} 3B, ${t.homeRuns} HR. Team AVG ${t.avg.toFixed(3)}, OBP ${t.obp.toFixed(3)}, SLG ${t.slg.toFixed(3)}, OPS ${t.ops.toFixed(3)}.

PLAYERS:
${lines}

Write the Quick Recap now.`;
}

const RECAP_SCHEMA = {
  type: "object",
  properties: {
    bullets: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["bullets"],
  additionalProperties: false,
} as const;

export async function generateRecap(
  report: GameReport,
  distinctId = "system"
): Promise<RecapResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("your_")) {
    return { bullets: ruleBasedRecap(report), source: "fallback" };
  }

  const client = new Anthropic({ apiKey });
  const start = Date.now();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: RECAP_SCHEMA },
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserPrompt(report) }],
    });

    const latencyMs = Date.now() - start;
    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const parsed = JSON.parse(raw) as { bullets?: string[] };
    const bullets = (parsed.bullets ?? []).filter((b) => b.trim().length > 0);

    const inputTokens = response.usage.input_tokens ?? 0;
    const outputTokens = response.usage.output_tokens ?? 0;
    const costUsd =
      (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
      (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;

    // LLM observability per the PRD (prompt-level cost/latency/token tracking).
    await captureServer(distinctId, "llm_recap_generated", {
      model: MODEL,
      game_id: report.opponent ?? "unknown",
      latency_ms: latencyMs,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cost_usd: Number(costUsd.toFixed(6)),
      bullet_count: bullets.length,
      stop_reason: response.stop_reason,
    });

    if (bullets.length === 0) {
      return { bullets: ruleBasedRecap(report), source: "fallback" };
    }
    return { bullets, source: "ai" };
  } catch (err) {
    await captureServer(distinctId, "llm_recap_failed", {
      model: MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    return { bullets: ruleBasedRecap(report), source: "fallback" };
  }
}
