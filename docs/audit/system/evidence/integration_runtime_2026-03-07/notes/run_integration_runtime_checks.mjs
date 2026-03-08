import fs from "node:fs";
import path from "node:path";

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFallback() {
  const repoRoot = process.cwd();
  const a = parseDotEnvFile(path.join(repoRoot, "supabase", ".env"));
  const b = parseDotEnvFile(path.join(repoRoot, ".env"));
  return { ...a, ...b };
}

function env(name, fallback) {
  return process.env[name] ?? fallback[name] ?? "";
}

async function callCase(baseUrl, anonKey, cronSecret, t) {
  const headers = { ...(t.headers || {}) };
  if (t.useAnonKey && anonKey) {
    headers.apikey = anonKey;
  }
  if (t.useCronSecret && cronSecret) {
    headers["x-cron-secret"] = cronSecret;
  }

  const res = await fetch(`${baseUrl}${t.path}`, {
    method: t.method,
    headers,
    body: t.body ? JSON.stringify(t.body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    id: t.id,
    method: t.method,
    path: t.path,
    expected: t.expected,
    status: res.status,
    ok: t.expected.statusIncludes.includes(res.status),
    contentType: res.headers.get("content-type"),
    bodyPreview: json ?? text.slice(0, 220),
  };
}

async function main() {
  const fallback = loadEnvFallback();
  const supabaseUrl = env("SUPABASE_URL", fallback).replace(/\/$/, "");
  const anonKey = env("SUPABASE_ANON_KEY", fallback);
  const cronSecret = env("CRON_SECRET", fallback);

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL from env/.env");
  }

  const base = path.resolve("docs/audit/system/evidence/integration_runtime_2026-03-07");
  const startedAt = new Date().toISOString();

  const cases = [
    {
      id: "checkout_unauthorized",
      method: "POST",
      path: "/functions/v1/create-checkout",
      useAnonKey: true,
      body: { planType: "starter", billingInterval: "monthly" },
      expected: { statusIncludes: [401] },
    },
    {
      id: "stripe_webhook_missing_signature",
      method: "POST",
      path: "/functions/v1/stripe-webhook",
      useAnonKey: true,
      body: { test: true },
      expected: { statusIncludes: [400] },
    },
    {
      id: "social_oauth_missing_auth",
      method: "POST",
      path: "/functions/v1/social-oauth",
      useAnonKey: true,
      body: { platform: "instagram", clientId: "00000000-0000-0000-0000-000000000000" },
      expected: { statusIncludes: [401] },
    },
    {
      id: "social_oauth_callback_missing_code_state",
      method: "GET",
      path: "/functions/v1/social-oauth-callback",
      expected: { statusIncludes: [200] },
    },
    {
      id: "cron_publish_without_secret",
      method: "POST",
      path: "/functions/v1/publish-scheduled-posts",
      useAnonKey: true,
      body: {},
      expected: { statusIncludes: [401] },
    },
    {
      id: "cron_refresh_without_secret",
      method: "POST",
      path: "/functions/v1/refresh-meta-tokens",
      useAnonKey: true,
      body: {},
      expected: { statusIncludes: [401] },
    },
    {
      id: "cron_sync_metrics_without_secret",
      method: "POST",
      path: "/functions/v1/sync-social-metrics",
      useAnonKey: true,
      body: {},
      expected: { statusIncludes: [401] },
    },
  ];

  if (cronSecret) {
    cases.push(
      {
        id: "cron_publish_with_secret",
        method: "POST",
        path: "/functions/v1/publish-scheduled-posts",
        useAnonKey: true,
        useCronSecret: true,
        body: {},
        expected: { statusIncludes: [200, 500] },
      },
      {
        id: "cron_refresh_with_secret",
        method: "POST",
        path: "/functions/v1/refresh-meta-tokens",
        useAnonKey: true,
        useCronSecret: true,
        body: {},
        expected: { statusIncludes: [200, 500] },
      },
      {
        id: "cron_sync_metrics_with_secret",
        method: "POST",
        path: "/functions/v1/sync-social-metrics",
        useAnonKey: true,
        useCronSecret: true,
        body: {},
        expected: { statusIncludes: [200, 500] },
      },
    );
  }

  const results = [];
  for (const t of cases) {
    try {
      const r = await callCase(supabaseUrl, anonKey, cronSecret, t);
      results.push(r);
    } catch (error) {
      results.push({
        id: t.id,
        method: t.method,
        path: t.path,
        expected: t.expected,
        status: null,
        ok: false,
        contentType: null,
        bodyPreview: String(error),
      });
    }
  }

  const endedAt = new Date().toISOString();
  const passCount = results.filter((r) => r.ok).length;

  const artifact = {
    startedAt,
    endedAt,
    supabaseUrlHost: new URL(supabaseUrl).host,
    cronSecretPresent: Boolean(cronSecret),
    passCount,
    totalCount: results.length,
    results,
  };

  fs.writeFileSync(path.join(base, "logs", "runtime_contract_checks.json"), JSON.stringify(artifact, null, 2));

  const md = [
    "# Integration Runtime Contract Checks",
    "",
    `Started: ${startedAt}`,
    `Ended: ${endedAt}`,
    `Supabase host: ${artifact.supabaseUrlHost}`,
    `Cron secret present: ${artifact.cronSecretPresent ? "yes" : "no"}`,
    `Pass: ${passCount}/${results.length}`,
    "",
    "| Case | Method | Path | Expected | Actual | OK |",
    "|---|---|---|---|---:|---|",
    ...results.map((r) => `| ${r.id} | ${r.method} | ${r.path} | ${r.expected.statusIncludes.join(" or ")} | ${r.status ?? "error"} | ${r.ok ? "yes" : "no"} |`),
  ].join("\n");
  fs.writeFileSync(path.join(base, "notes", "runtime_contract_checks_summary.md"), md);

  console.log(`integration_runtime_checks: ${passCount}/${results.length} cases matched expected status contracts`);
}

main().catch((err) => {
  console.error(`integration_runtime_checks failed: ${err?.message ?? String(err)}`);
  process.exitCode = 1;
});
