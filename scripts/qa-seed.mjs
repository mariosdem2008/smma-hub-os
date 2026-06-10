#!/usr/bin/env node
// Autonomous QA seeding — creates a confirmed agency owner, an agency with a
// completed onboarding gate, and a client with a usable brain, so the
// authenticated app (dashboard, client workspace, all tabs) can be verified
// WITHOUT a human and WITHOUT the AI onboarding flow (no paid keys spent).
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt> \
//   SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...> \
//   node scripts/qa-seed.mjs
//
// Prints the QA email/password to use in the app login form, plus the agency
// and client ids. Re-running creates a fresh isolated QA tenant each time.

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SVC) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const svcHeaders = {
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
  "Content-Type": "application/json",
};

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

async function rest(path, body, { method = "POST", representation = true } = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { ...svcHeaders, ...(representation ? { Prefer: "return=representation" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`);
  return Array.isArray(json) ? json[0] : json;
}

async function main() {
  const stamp = Date.now();
  const email = `qa-founder+${stamp}@smmahub-qa.dev`;
  const password = "QaFounder!2026xZ";

  // 1) confirmed auth user
  const user = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: svcHeaders,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: "QA Founder" } }),
  }).then((r) => r.json());
  const userId = user.id;
  if (!userId) throw new Error(`user create failed: ${JSON.stringify(user)}`);

  // 2) agency + owner membership
  const agency = await rest("agencies", { user_id: userId, name: "QA Founder Agency", niche: "fitness", website: "https://qa-agency.example.com" });
  await rest("agency_members", { agency_id: agency.id, user_id: userId, role: "owner", accepted_at: nowIso() });

  // 3) agency onboarding marked complete (bypasses the AI onboarding gate)
  await rest("ai_onboarding_status", {
    agency_id: agency.id, scope: "agency", client_id: null,
    status: "complete", started_at: nowIso(), completed_at: nowIso(), last_step_id: "review",
  });

  // 4) client with a usable brain (bypasses the client-setup gate)
  const clientId = uuid();
  const portalSlug = `qa-client-${stamp}`;
  await rest("clients", {
    id: clientId, agency_id: agency.id, name: "QA Demo Client", niche: "fitness",
    status: "active", portal_enabled: true, portal_slug: portalSlug, website: "https://qa-client.example.com",
  });
  const brainJson = {
    brand_basics: { business_name: "QA Demo Client", name: "QA Demo Client", niche: "fitness" },
    offer_details: { core_offer: "12-week body transformation", products_services: ["12-week transformation"], cta: "Book a free consult" },
    audience: { primary: "busy professionals 30-45", problems: ["no time", "low energy"], pain_points: ["no time", "low energy"] },
    goals: { primary_goal: "lead generation" },
    pillars: ["authority", "proof", "conversion"],
  };
  // brain row is auto-created by trigger; update it to usable
  await rest(`client_brains?client_id=eq.${clientId}`, { status: "usable", usable: true, confidence: 80, brain_json: brainJson }, { method: "PATCH" });

  console.log(JSON.stringify({
    ok: true, login: { email, password },
    agency_id: agency.id, user_id: userId,
    client_id: clientId, portal_slug: portalSlug,
    note: "Log in at /auth with login.email/password. Client workspace at /clients/<client_id>.",
  }, null, 2));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
