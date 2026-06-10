// Founder validation of the governed grader's deterministic enforcement layer
// (no model, no paid keys). Proves: banned claims block, missing disclaimers
// block, generic filler is flagged, and on-brand specific copy passes.
import { deterministicGradeAgainstGovernance } from "../supabase/functions/_shared/answer-grading.ts";

const governance = {
  compliance: {
    banned_claims: ["guaranteed results", "#1 in the world", "guarantee"],
    required_disclaimers: ["Results vary by client."],
    restricted_topics: ["medical advice"],
  },
  agency: {
    tone: "calm, evidence-led, never hypey",
    quality_bar: "specific, operator-grade, grounded in the client's real context",
  },
};

const cases: Array<{ name: string; text: string; expectAccepted: boolean }> = [
  {
    name: "banned claim (hype promise)",
    text: "Our system delivers guaranteed results for every fitness studio — you will become #1 in the world. Results vary by client.",
    expectAccepted: false,
  },
  {
    name: "missing required disclaimer",
    text: "For busy professionals, post three proof-led reels per week showing real client check-ins, then route to a booked consult via the link in bio.",
    expectAccepted: false,
  },
  {
    name: "generic filler (shallow)",
    text: "Boost your business and grow your brand to take it to the next level. Results vary by client.",
    expectAccepted: false,
  },
  {
    name: "on-brand, specific, compliant",
    text: "For busy professionals 30-45, run a weekly proof reel: a 20-second client check-in showing one concrete result, captioned with the small-group accountability angle, CTA to book a consult. Results vary by client.",
    expectAccepted: true,
  },
];

let pass = 0;
for (const c of cases) {
  const r = deterministicGradeAgainstGovernance({ text: c.text, governance, contentType: "caption" });
  const ok = r.accepted === c.expectAccepted;
  if (ok) pass++;
  console.log(`\n[${ok ? "PASS" : "FAIL"}] ${c.name}`);
  console.log(`  accepted=${r.accepted} (expected ${c.expectAccepted}) score=${r.score}`);
  if (r.hard_violations.length) console.log(`  hard: ${r.hard_violations.map((v) => v.code + ":" + v.message).join(" | ")}`);
  if (r.soft_issues.length) console.log(`  soft: ${r.soft_issues.map((s) => s.code).join(", ")}`);
}
console.log(`\n=== ${pass}/${cases.length} validation cases passed ===`);
Deno.exit(pass === cases.length ? 0 : 1);
