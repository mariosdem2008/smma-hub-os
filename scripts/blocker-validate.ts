// Founder validation of the blocker-detection agent (deterministic, no keys).
import { detectClientBlockers } from "../supabase/functions/_shared/blocker-detection.ts";

const now = new Date("2026-06-10T12:00:00Z");
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

// A realistic "in trouble" client.
const blocked = detectClientBlockers({
  clientId: "c-1",
  now,
  brainStatus: { usable: false, missing_fields: ["offer_details.products_services", "audience.problems"], missing_fields_count: 2 },
  enrichmentQueue: [{ id: "e1", title: "Confirm budget", status: "ready", priority: "high", source_kind: "strategy_blocker" }],
  executionTasks: [{ id: "t1", title: "Edit reel", status: "blocked", priority: "urgent", due_at: threeDaysAgo }],
  operationsSetup: { primary_contact_name: "", main_approver_name: "", required_access_status: ["instagram not connected"] },
  projects: [{ id: "p1", title: "June launch reel", status: "client_review", last_moved_at: threeDaysAgo }],
  strategyState: { onboardingComplete: true, hasApprovedStrategy: false },
});

// A healthy client.
const clear = detectClientBlockers({
  clientId: "c-2",
  now,
  brainStatus: { usable: true, missing_fields: [], missing_fields_count: 0 },
  enrichmentQueue: [],
  executionTasks: [{ id: "t2", title: "Post", status: "done" }],
  operationsSetup: { primary_contact_name: "Mia", main_approver_name: "Mia", required_access_status: ["instagram connected"] },
  projects: [{ id: "p2", title: "Reel", status: "published" }],
  strategyState: { onboardingComplete: true, hasApprovedStrategy: true },
});

function check(name: string, cond: boolean) {
  console.log(`[${cond ? "PASS" : "FAIL"}] ${name}`);
  return cond;
}

const codes = blocked.blockers.map((b) => b.code);
let pass = 0;
const checks = [
  check("blocked client -> delivery_state=blocked", blocked.delivery_state === "blocked"),
  check("detects brain incomplete (owner=client)", blocked.blockers.some((b) => b.code === "client_brain_incomplete" && b.owner === "client")),
  check("detects open enrichment", codes.includes("enrichment_queue_open")),
  check("detects blocked/overdue execution task (owner=agency)", blocked.blockers.some((b) => b.code === "execution_tasks_blocked" && b.owner === "agency")),
  check("detects operations setup gap", codes.includes("operations_setup_incomplete")),
  check("detects stalled approval (owner=client)", blocked.blockers.some((b) => b.code === "approval_stalled" && b.owner === "client")),
  check("detects no approved strategy", codes.includes("strategy_not_approved")),
  check("every blocker has a deep_link + next action", blocked.blockers.every((b) => b.deep_link && b.recommended_next_action)),
  check("healthy client -> on_track with 0 blockers", clear.delivery_state === "on_track" && clear.blockers.length === 0),
];
pass = checks.filter(Boolean).length;
console.log(`\nblocked client blockers (${blocked.blockers.length}): ${codes.join(", ")}`);
console.log(`=== ${pass}/${checks.length} checks passed ===`);
Deno.exit(pass === checks.length ? 0 : 1);
