// Founder validation of the Agency Pulse aggregator (deterministic, no keys).
import { buildAgencyPulse } from "../supabase/functions/_shared/agency-pulse.ts";

const now = new Date("2026-06-11T12:00:00Z");
const days = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

const mixed = buildAgencyPulse({
  now,
  clients: [
    { id: "c1", name: "Blocked Co", status: "active" },
    { id: "c2", name: "Flagged Co", status: "active" },
    { id: "c3", name: "NoStrategy Co", status: "active" },
    { id: "c4", name: "Healthy Co", status: "active" },
  ],
  blockerSnapshots: [
    { client_id: "c1", delivery_state: "blocked", scanned_at: days(0), blockers: [
      { code: "client_brain_incomplete", severity: "high", title: "Client brain is incomplete", owner: "client", recommended_next_action: "Ask client to finish onboarding", deep_link: "/clients/c1?tab=overview", signal_source: "get_client_brain_status" },
    ] },
    { client_id: "c4", delivery_state: "on_track", scanned_at: days(0), blockers: [] },
  ],
  gradings: [
    { id: "g1", client_id: "c2", surface: "generate-ai-content", accepted: false, hard_violations: [{ code: "banned_claim" }], created_at: days(1) },
  ],
  strategyStates: [
    { client_id: "c3", onboarding_complete: true, has_approved_strategy: false },
    { client_id: "c4", onboarding_complete: true, has_approved_strategy: true, approved_strategy_at: days(5) },
  ],
  reportStates: [
    { client_id: "c4", current_period: "2026-06", current_period_report_generated: true },
  ],
});

const empty = buildAgencyPulse({ now, clients: [], blockerSnapshots: [], gradings: [], strategyStates: [], reportStates: [] });

function check(name: string, cond: boolean) { console.log(`[${cond ? "PASS" : "FAIL"}] ${name}`); return cond; }
const types = mixed.attention.map((a) => `${a.client_id}:${a.signal_type}`);
const checks = [
  check("summary counts clients", mixed.summary.clients_total === 4),
  check("1 blocked, 1 on_track in summary", mixed.summary.blocked >= 1 && mixed.summary.on_track >= 1),
  check("blocker surfaced for c1 (responsible=blocker)", mixed.attention.some((a) => a.client_id === "c1" && a.signal_type === "blocker")),
  check("flagged_content surfaced for c2 (responsible=grading)", mixed.attention.some((a) => a.client_id === "c2" && a.signal_type === "flagged_content" && a.responsible_agent === "grading")),
  check("strategy_missing surfaced for c3", mixed.attention.some((a) => a.client_id === "c3" && a.signal_type === "strategy_missing")),
  check("healthy c4 produces no attention item", !mixed.attention.some((a) => a.client_id === "c4")),
  check("every attention item has deep_link + action + owner", mixed.attention.every((a) => a.deep_link && a.recommended_action && a.owner)),
  check("sorted high-severity first", mixed.attention.length === 0 || mixed.attention[0].severity === "high"),
  check("empty agency -> empty attention", empty.attention.length === 0 && empty.summary.clients_total === 0),
];
const pass = checks.filter(Boolean).length;
console.log(`\nattention (${mixed.attention.length}): ${types.join(", ")}`);
console.log(`=== ${pass}/${checks.length} checks passed ===`);
Deno.exit(pass === checks.length ? 0 : 1);
