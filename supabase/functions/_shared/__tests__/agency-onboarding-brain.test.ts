import { describe, expect, it, vi } from "vitest";
import {
  AGENCY_ONBOARDING_CONTENT_SOURCE,
  buildAgencyBrainDocumentsFromSnapshot,
  contentJsonEquals,
  materializeAgencyOnboardingBrainDocuments,
} from "../agency-onboarding-brain.ts";

const FULL_SNAPSHOT: Record<string, unknown> = {
  agency: {
    name: "Bootstrap Agency",
    timezone: "Europe/Nicosia",
    primary_client_languages: ["English 70%", "Greek 30%"],
    team_size_total: "7",
    active_paying_clients: "12",
    top_industries: ["Gyms", "Dentists"],
    website_and_links: ["https://bootstrapagency.com"],
    role_counts: ["strategist,2", "editor,3"],
    best_client_summary: "Local gym owner seeking 10-30 new signups per month.",
    key_differentiators: ["48h turnaround", "Founder-led strategy", "Niche expertise"],
    client_type_split: ["SMB 70", "Mid 20", "Enterprise 10"],
    who_to_avoid: ["No decision-maker access"],
    proof_metrics: ["+120% leads in 60 days"],
    competitor_urls: ["https://competitor-1.com"],
    service_catalog: ["Paid Ads | Meta + Google", "Social Mgmt | Monthly strategy"],
    top_margin_offers: ["Retainer Growth | Weekly strategy; 12 creatives; reporting | 1500-2500 | Reusable"],
    packaged_offers: ["Lead Engine | 40 leads/month | 12 creatives; ad mgmt | 30 days | 1500-2500"],
    pricing_model: "Fixed retainer | Predictable monthly workload",
    price_ranges_by_tier: ["Starter,500,900", "Growth,1000,1800"],
  },
  operations: {
    required_client_assets: ["Brand guidelines | 5"],
    approval_workflow: ["Founder,email,48"],
    turnaround_slas: ["drafts:48", "edits:24", "urgent:6"],
    reporting_cadence: "Weekly email + monthly dashboard",
    tools_stack: ["Notion", "GA4"],
    platforms_managed: ["Instagram", "TikTok"],
    rep_policy_boundaries: ["No legal or medical claims", "No guaranteed outcomes"],
    paid_ads_account_access: "Meta Business Manager + owner@client.com",
    paid_ads_spend_bracket: "1500-5000",
  },
  ai: {
    persona_name: "Nova",
    role_title: "Strategy Partner",
    personality_traits: ["Direct:High", "Friendly:Med", "Analytical:High"],
    writing_preferences: "Tone: Neutral | Length: Short | Emojis: 0 | CTA: Yes",
  },
  persona: {
    tone_traits: ["calm", "confident"],
    expertise_traits: ["paid social"],
  },
};

type DocRow = Record<string, unknown>;

function makeSupabaseMock(options: {
  existingApprovedByModule?: Record<string, DocRow>;
  updateError?: { message: string } | null;
  insertError?: { message: string } | null;
}) {
  const existing = options.existingApprovedByModule ?? {};
  const inserts: DocRow[] = [];
  const updates: Array<{ id: string; patch: DocRow }> = [];
  const versionInserts: DocRow[] = [];
  let idCounter = 0;

  const from = vi.fn((table: string) => {
    if (table === "brain_documents") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((_col: string, _agencyId: string) => ({
            eq: vi.fn((_col2: string, module: string) => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: existing[module] ?? null,
                  error: null,
                })),
              })),
            })),
          })),
        })),
        insert: vi.fn((payload: DocRow) => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => {
              if (options.insertError) return { data: null, error: options.insertError };
              idCounter += 1;
              const row = { id: `doc-${idCounter}`, version: 1, ...payload };
              inserts.push(row);
              return { data: row, error: null };
            }),
          })),
        })),
        update: vi.fn((patch: DocRow) => ({
          eq: vi.fn((_col: string, id: string) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                if (options.updateError) return { data: null, error: options.updateError };
                const base = Object.values(existing).find((row) => row.id === id) ?? {};
                const row = { ...base, ...patch, id };
                updates.push({ id, patch });
                return { data: row, error: null };
              }),
            })),
          })),
        })),
      };
    }
    if (table === "brain_document_versions") {
      return {
        insert: vi.fn(async (payload: DocRow) => {
          versionInserts.push(payload);
          return { data: null, error: null };
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from }, inserts, updates, versionInserts };
}

describe("buildAgencyBrainDocumentsFromSnapshot", () => {
  it("maps a full snapshot to all five brain modules", () => {
    const documents = buildAgencyBrainDocumentsFromSnapshot(FULL_SNAPSHOT);
    const modules = documents.map((doc) => doc.module);

    expect(modules).toEqual(["bootstrap", "offer_stack", "quality_bar", "rep_policy", "tone_voice"]);

    const bootstrap = documents.find((doc) => doc.module === "bootstrap")!;
    expect(bootstrap.content_json.agency_name).toBe("Bootstrap Agency");
    expect(bootstrap.content_json.target_industries).toEqual(["Gyms", "Dentists"]);
    expect(bootstrap.content_json.positioning).toMatchObject({
      best_client_summary: "Local gym owner seeking 10-30 new signups per month.",
      key_differentiators: ["48h turnaround", "Founder-led strategy", "Niche expertise"],
    });
    expect(bootstrap.content_json.source).toBe(AGENCY_ONBOARDING_CONTENT_SOURCE);
    expect(typeof bootstrap.content_json.summary).toBe("string");

    const offerStack = documents.find((doc) => doc.module === "offer_stack")!;
    expect(offerStack.content_json.pricing_model).toBe("Fixed retainer | Predictable monthly workload");
    expect(offerStack.content_json.service_catalog).toEqual([
      "Paid Ads | Meta + Google",
      "Social Mgmt | Monthly strategy",
    ]);

    const qualityBar = documents.find((doc) => doc.module === "quality_bar")!;
    expect(qualityBar.content_json.approval_workflow).toEqual(["Founder,email,48"]);
    expect(qualityBar.content_json.reporting_cadence).toBe("Weekly email + monthly dashboard");

    const repPolicy = documents.find((doc) => doc.module === "rep_policy")!;
    expect(repPolicy.content_json.boundaries).toEqual([
      "No legal or medical claims",
      "No guaranteed outcomes",
    ]);

    const toneVoice = documents.find((doc) => doc.module === "tone_voice")!;
    expect(toneVoice.content_json.assistant_name).toBe("Nova");
    expect(toneVoice.content_json.tone_traits).toEqual(["calm", "confident"]);
  });

  it("only emits modules covered by a partial snapshot", () => {
    const documents = buildAgencyBrainDocumentsFromSnapshot({
      agency: {
        name: "Partial Agency",
        service_catalog: ["Social Mgmt | Monthly strategy"],
      },
    });

    expect(documents.map((doc) => doc.module)).toEqual(["bootstrap", "offer_stack"]);
    const bootstrap = documents.find((doc) => doc.module === "bootstrap")!;
    expect(bootstrap.content_json.positioning).toBeUndefined();
  });

  it("resolves legacy alias paths from older snapshots", () => {
    const documents = buildAgencyBrainDocumentsFromSnapshot({
      bootstrap: { agency_name: "Alias Agency" },
      rep_policy: { boundaries: ["No medical claims"] },
    });

    const modules = documents.map((doc) => doc.module);
    expect(modules).toContain("bootstrap");
    expect(modules).toContain("rep_policy");
    expect(documents.find((doc) => doc.module === "bootstrap")!.content_json.agency_name).toBe("Alias Agency");
  });

  it("returns no documents for an empty snapshot", () => {
    expect(buildAgencyBrainDocumentsFromSnapshot({})).toEqual([]);
  });
});

describe("materializeAgencyOnboardingBrainDocuments", () => {
  it("creates approved documents with version records and ingests them", async () => {
    const mock = makeSupabaseMock({});
    const ingest = vi.fn(async () => ({}));

    const result = await materializeAgencyOnboardingBrainDocuments({
      supabase: mock.client as any,
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: FULL_SNAPSHOT,
      ingestBrainDocumentForRag: ingest,
    });

    expect(result.created).toEqual(["bootstrap", "offer_stack", "quality_bar", "rep_policy", "tone_voice"]);
    expect(result.updated).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.ingested).toHaveLength(5);
    expect(ingest).toHaveBeenCalledTimes(5);

    expect(mock.inserts).toHaveLength(5);
    for (const row of mock.inserts) {
      expect(row.status).toBe("approved");
      expect(row.source).toBe("onboarding");
      expect(row.approved_by).toBe("user-1");
      expect(row.created_by).toBe("user-1");
      expect((row.content_json as Record<string, unknown>).source).toBe(AGENCY_ONBOARDING_CONTENT_SOURCE);
    }
    expect(mock.versionInserts).toHaveLength(5);
    expect(mock.versionInserts[0]).toMatchObject({
      version: 1,
      change_summary: "Created from agency onboarding completion",
      created_by: "user-1",
    });
  });

  it("is idempotent: skips unchanged onboarding documents on re-run", async () => {
    const documents = buildAgencyBrainDocumentsFromSnapshot(FULL_SNAPSHOT);
    const existingApprovedByModule: Record<string, DocRow> = {};
    documents.forEach((doc, index) => {
      existingApprovedByModule[doc.module] = {
        id: `existing-${index}`,
        agency_id: "agency-1",
        module: doc.module,
        title: doc.title,
        content_json: doc.content_json,
        status: "approved",
        source: "onboarding",
        version: 1,
      };
    });

    const mock = makeSupabaseMock({ existingApprovedByModule });
    const ingest = vi.fn(async () => ({}));

    const result = await materializeAgencyOnboardingBrainDocuments({
      supabase: mock.client as any,
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: FULL_SNAPSHOT,
      ingestBrainDocumentForRag: ingest,
    });

    expect(result.created).toEqual([]);
    expect(result.updated).toEqual([]);
    expect(result.skipped).toHaveLength(5);
    expect(result.skipped.every((entry) => entry.reason === "unchanged")).toBe(true);
    expect(ingest).not.toHaveBeenCalled();
    expect(mock.inserts).toHaveLength(0);
    expect(mock.updates).toHaveLength(0);
  });

  it("updates changed onboarding documents and bumps the version", async () => {
    const existingApprovedByModule: Record<string, DocRow> = {
      bootstrap: {
        id: "existing-bootstrap",
        agency_id: "agency-1",
        module: "bootstrap",
        title: "Bootstrap Profile (Default Brain Pack v1)",
        content_json: { agency_name: "Old Name" },
        status: "approved",
        source: "onboarding",
        version: 3,
      },
    };

    const mock = makeSupabaseMock({ existingApprovedByModule });
    const ingest = vi.fn(async () => ({}));

    const result = await materializeAgencyOnboardingBrainDocuments({
      supabase: mock.client as any,
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: { agency: { name: "Bootstrap Agency" } },
      ingestBrainDocumentForRag: ingest,
    });

    expect(result.updated).toEqual(["bootstrap"]);
    expect(result.created).toEqual([]);
    expect(mock.updates).toHaveLength(1);
    expect(mock.updates[0].id).toBe("existing-bootstrap");
    expect(mock.updates[0].patch.version).toBe(4);
    expect(mock.updates[0].patch.approved_by).toBe("user-1");
    expect(mock.versionInserts).toHaveLength(1);
    expect(mock.versionInserts[0]).toMatchObject({
      document_id: "existing-bootstrap",
      version: 4,
      change_summary: "Updated from agency onboarding completion",
    });
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it("never overwrites documents approved through the Brain UI", async () => {
    const existingApprovedByModule: Record<string, DocRow> = {
      bootstrap: {
        id: "manual-doc",
        agency_id: "agency-1",
        module: "bootstrap",
        title: "Hand-curated profile",
        content_json: { agency_name: "Hand Edited" },
        status: "approved",
        source: "manual",
        version: 5,
      },
    };

    const mock = makeSupabaseMock({ existingApprovedByModule });
    const ingest = vi.fn(async () => ({}));

    const result = await materializeAgencyOnboardingBrainDocuments({
      supabase: mock.client as any,
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: { agency: { name: "Bootstrap Agency" } },
      ingestBrainDocumentForRag: ingest,
    });

    expect(result.skipped).toEqual([{ module: "bootstrap", reason: "manual_document" }]);
    expect(result.updated).toEqual([]);
    expect(result.created).toEqual([]);
    expect(mock.updates).toHaveLength(0);
    expect(mock.inserts).toHaveLength(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("records ingestion failures without failing the document write", async () => {
    const mock = makeSupabaseMock({});
    const ingest = vi.fn(async () => {
      throw new Error("embedding provider down");
    });

    const result = await materializeAgencyOnboardingBrainDocuments({
      supabase: mock.client as any,
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: { agency: { name: "Bootstrap Agency" } },
      ingestBrainDocumentForRag: ingest,
    });

    expect(result.created).toEqual(["bootstrap"]);
    expect(result.ingest_failed).toEqual(["bootstrap"]);
    expect(result.ingested).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("records per-module write failures without throwing", async () => {
    const mock = makeSupabaseMock({ insertError: { message: "insert denied" } });
    const ingest = vi.fn(async () => ({}));

    const result = await materializeAgencyOnboardingBrainDocuments({
      supabase: mock.client as any,
      agencyId: "agency-1",
      userId: "user-1",
      snapshot: { agency: { name: "Bootstrap Agency" } },
      ingestBrainDocumentForRag: ingest,
    });

    expect(result.created).toEqual([]);
    expect(result.errors).toEqual([{ module: "bootstrap", message: "insert denied" }]);
    expect(ingest).not.toHaveBeenCalled();
  });
});

describe("contentJsonEquals", () => {
  it("ignores key order", () => {
    expect(contentJsonEquals({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(contentJsonEquals({ a: 1 }, { a: 2 })).toBe(false);
  });
});
