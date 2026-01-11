import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);

const hasFlag = (name) => args.includes(name);
const getArgValue = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const envOr = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const supabaseUrl = getArgValue("--supabase-url") ?? envOr("SUPABASE_URL", "VITE_SUPABASE_URL");
const serviceRoleKey = getArgValue("--service-role-key") ?? envOr("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = getArgValue("--cron-secret") ?? envOr("CRON_SECRET");

const dryRun = hasFlag("--dry-run");
const perMinute = Number(getArgValue("--per-minute") ?? envOr("BACKFILL_PER_MINUTE") ?? "5");
const limit = Number(getArgValue("--limit") ?? envOr("BACKFILL_LIMIT") ?? "0");
const pageSize = Number(getArgValue("--page-size") ?? envOr("BACKFILL_PAGE_SIZE") ?? "200");

if (!supabaseUrl || !serviceRoleKey || !cronSecret) {
  console.error(
    [
      "Missing required inputs.",
      "Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET",
      "Or args: --supabase-url --service-role-key --cron-secret",
    ].join("\n"),
  );
  process.exit(1);
}

if (!Number.isFinite(perMinute) || perMinute <= 0) {
  console.error("--per-minute must be a positive number");
  process.exit(1);
}

const delayMs = Math.ceil(60_000 / perMinute);
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function listAgenciesWithZeroBrainDocs(offset) {
  const { data, error } = await supabase.rpc("list_agencies_with_zero_brain_documents", {
    p_limit: pageSize,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []).map((row) => row.agency_id);
}

async function countTable(table) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function seedOneAgency(agencyId) {
  const res = await fetch(`${supabaseUrl}/functions/v1/ai-seed-default-brain-pack-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({ agency_id: agencyId }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error ?? `HTTP ${res.status}`);
  }
  return json;
}

const run = async () => {
  const startedAt = Date.now();
  const totalAgencies = await countTable("agencies");

  console.log("Default Brain Pack v1 backfill");
  console.log(`- dry_run: ${dryRun}`);
  console.log(`- rate_limit: ${perMinute}/minute (${delayMs}ms between agencies)`);
  console.log(`- agencies_total: ${totalAgencies}`);
  if (limit > 0) console.log(`- limit: ${limit}`);
  console.log("");

  let offset = 0;
  let eligible = 0;
  let attempted = 0;
  let seeded = 0;
  let skipped = 0;
  let errors = 0;

  while (true) {
    const agencyIds = await listAgenciesWithZeroBrainDocs(offset);
    if (!agencyIds.length) break;

    for (const agencyId of agencyIds) {
      eligible += 1;
      if (limit > 0 && attempted >= limit) break;

      if (dryRun) {
        console.log(`[dry-run] eligible agency: ${agencyId}`);
        continue;
      }

      attempted += 1;
      try {
        const result = await seedOneAgency(agencyId);
        if (result?.seeded) {
          seeded += 1;
          console.log(`[seeded] agency=${agencyId} docs=${(result.document_ids ?? []).length} ingested=${Boolean(result.ingested)}`);
        } else {
          skipped += 1;
          console.log(`[skipped] agency=${agencyId}`);
        }
      } catch (err) {
        errors += 1;
        console.error(`[error] agency=${agencyId} message=${err?.message ?? err}`);
      }

      if (limit > 0 && attempted >= limit) break;
      await sleep(delayMs);
    }

    if (limit > 0 && attempted >= limit) break;
    offset += pageSize;
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log("");
  console.log("Progress summary");
  console.log(`- eligible_agencies: ${eligible}`);
  console.log(`- attempted: ${attempted}`);
  console.log(`- seeded: ${seeded}`);
  console.log(`- skipped: ${skipped}`);
  console.log(`- errors: ${errors}`);
  console.log(`- elapsed_s: ${elapsed}`);

  process.exit(errors > 0 ? 2 : 0);
};

run().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

