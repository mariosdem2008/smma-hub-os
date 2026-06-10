// Governance probe: does the agency brain actually CHANGE strategy-agent output?
// Runs the REAL strategy-recommendation prompt builder against a local model
// (Ollama, no paid keys), once with a rich agency-governance context and once
// with none, then checks whether the governed run obeys the brain:
//   - uses the agency's distinctive offer name
//   - avoids the agency's banned claims
//   - carries the banned claims into messaging "donts"
//
// Usage (PowerShell):
//   $env:OPENAI_BASE_URL="http://localhost:11434/v1"; $env:OPENAI_API_KEY="ollama"
//   deno run --allow-net --allow-env scripts/agent-governance-probe.ts qwen2.5-coder:1.5b
//
// This is a diagnostic, not a pass/fail gate — it tells us where prompts ignore
// the brain so the prompt assembly can be hardened.

import { generate } from "../src/ai/providers/openai.ts";
import { buildStrategyRecommendationPrompt } from "../src/ai/prompts/strategyRecommendation.ts";

const model = Deno.args[0] ?? "qwen2.5-coder:1.5b";
if (!Deno.env.get("OPENAI_BASE_URL")) Deno.env.set("OPENAI_BASE_URL", "http://localhost:11434/v1");
if (!Deno.env.get("OPENAI_API_KEY")) Deno.env.set("OPENAI_API_KEY", "ollama");

const OFFER_NAME = "Studio Transformation Sprint";
const BANNED = ["guaranteed", "guarantee", "#1 in the world", "miracle"];

const brief = {
  business_model: { summary: "Boutique fitness studio coaching busy professionals", category: "fitness coaching" },
  offer_priority: { primary_offer: OFFER_NAME },
  audience_segments: [{ name: "busy professionals 30-45", jobs_to_be_done: ["get fit without wasting time"], pain_points: ["no time", "low energy"] }],
  conversion_path: { primary_path: "instagram -> book_call" },
  channel_state_and_history: { active_channels: ["instagram"] },
  goals_baselines_success_thresholds: { primary_goal: "qualified consultation bookings" },
  proof_and_differentiators: { differentiators: ["small-group accountability", "evidence-led programming"] },
};

const diagnosis = {
  body: {
    current_state_summary: "Viable offer, weak proof distribution and unclear funnel handoff.",
    top_opportunities: ["Systemize proof on instagram", "Tighten the book_call handoff"],
  },
};

// The governance block mirrors what ai-strategy-generate injects from the agency
// AI Setup wizard (meta_json.guardrails/foundations/workflow).
const governance = [
  "AgencyGovernance (configured by the agency; binding on all outputs):",
  JSON.stringify({
    foundations: { offer_stack: [OFFER_NAME], service_model: "done-for-you content + strategy", quality_standard: "evidence-led, specific, no hype" },
    guardrails: { banned_claims: BANNED, restricted_topics: ["medical claims"], tone: "calm, confident, evidence-led, never hypey" },
    workflow: { approval_required_for: ["any performance claim"] },
  }),
  "GovernanceRules:",
  "- Never use any banned_claim wording.",
  `- Anchor the recommendation on the agency offer stack (use the offer name "${OFFER_NAME}").`,
  "- Match the agency tone: calm, evidence-led, never hypey.",
  "- Put each banned_claim into messaging_direction.donts.",
].join("\n");

function buildContext(withGovernance: boolean) {
  return [
    "Strategy Recommendation Context",
    `Brief:\n${JSON.stringify(brief)}`,
    `DiagnosisArtifact:\n${JSON.stringify(diagnosis)}`,
    withGovernance ? governance : "AgencyGovernance: (none configured)",
  ].join("\n\n");
}

async function run(withGovernance: boolean) {
  const messages = buildStrategyRecommendationPrompt({ context: buildContext(withGovernance) });
  const res = await generate({ model, messages, temperature: 0.2, max_tokens: 900 } as any);
  return (res.text ?? "").trim();
}

function tryParse(text: string): any | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

function hasBanned(values: unknown): string[] {
  const text = JSON.stringify(values ?? "").toLowerCase();
  return BANNED.filter((b) => text.includes(b.toLowerCase()));
}

function score(label: string, text: string) {
  const parsed = tryParse(text);
  const md = parsed?.body?.messaging_direction ?? {};
  const dos = md?.dos ?? [];
  const donts = md?.donts ?? [];
  const dosBanned = hasBanned(dos);          // banned term as a positive instruction = VIOLATION
  const dontsBanned = hasBanned(donts);      // banned term listed as a don't = governance obeyed
  // banned terms used anywhere as positive copy (summary/strategic_direction/core_message)
  const positiveCopy = [parsed?.summary, parsed?.body?.strategic_direction, md?.core_message].join(" ");
  const positiveBanned = hasBanned(positiveCopy);
  const usesOffer = JSON.stringify(parsed ?? text).toLowerCase().includes(OFFER_NAME.toLowerCase());

  console.log(`\n=== ${label} ===`);
  console.log(`parsed JSON: ${parsed ? "yes" : "NO (model output not valid JSON)"}`);
  console.log(`uses offer name: ${usesOffer ? "YES" : "no"}`);
  console.log(`VIOLATION banned term in dos/positive copy: ${[...dosBanned, ...positiveBanned].length ? [...new Set([...dosBanned, ...positiveBanned])].join(", ") : "none ✓"}`);
  console.log(`banned terms correctly in donts: ${dontsBanned.length ? dontsBanned.join(", ") : "none"}`);
  return { parsed: !!parsed, usesOffer, violation: [...new Set([...dosBanned, ...positiveBanned])], dontsBanned };
}

console.log(`[governance-probe] model=${model} base=${Deno.env.get("OPENAI_BASE_URL")}`);
try {
  const governed = await run(true);
  const control = await run(false);
  const g = score("GOVERNED (brain configured)", governed);
  const c = score("CONTROL (no governance)", control);

  console.log("\n=== VERDICT ===");
  console.log(`governed run made NO banned-claim violation: ${g.violation.length === 0 ? "YES ✓" : "NO — " + g.violation.join(", ")}`);
  console.log(`governed run routed banned claims into donts: ${g.dontsBanned.length ? "YES ✓ (" + g.dontsBanned.join(", ") + ")" : "no"}`);
  console.log(`governance vs control differs on banned handling: ${(g.dontsBanned.length > c.dontsBanned.length) ? "YES ✓ (brain enforced donts the control omitted)" : "weak/none"}`);
  Deno.exit(0);
} catch (err) {
  console.error(`[governance-probe] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  Deno.exit(1);
}
