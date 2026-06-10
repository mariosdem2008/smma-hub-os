/**
 * Agency Onboarding Brain Materialization
 *
 * Converts the draft brain snapshot collected by the agency onboarding flow
 * (ai_onboarding_status.metadata.draft_brain_json) into approved
 * brain_documents rows so downstream consumers (strategy generation, RAG
 * retrieval, readiness scoring) can use the answers the agency owner gave.
 *
 * The agency owner authored every answer, so owner authorship counts as
 * approval: documents are written with status='approved' and the acting user
 * recorded as approver.
 *
 * Idempotency rules:
 * - One approved document per (agency_id, module) is enforced by the database.
 * - Re-running upserts documents whose source is 'onboarding' (this flow or
 *   the default brain pack seed) and whose content changed.
 * - Documents created or approved through the Brain UI (source 'manual',
 *   'chat', 'ai_proposed') are NEVER overwritten.
 */

import { resolveSnapshotValue } from "../../../src/ai/onboardingState.ts";
import type { BrainDocument, BrainModule } from "./brain-documents.ts";

type MaybeSingleResult<T> = { data: T | null; error?: { message?: string } | null };

type MinimalSupabase = {
  from: (table: string) => any;
};

export const AGENCY_ONBOARDING_CONTENT_SOURCE = "agency_onboarding";

export type MappedAgencyBrainDocument = {
  module: BrainModule;
  title: string;
  content_json: Record<string, unknown>;
};

export type AgencyOnboardingBrainMaterializeResult = {
  created: string[];
  updated: string[];
  skipped: Array<{ module: string; reason: "manual_document" | "unchanged" }>;
  ingested: string[];
  ingest_failed: string[];
  errors: Array<{ module: string; message: string }>;
};

type SnapshotFieldSpec = {
  /** Key used inside content_json. */
  key: string;
  /** Snapshot field path (resolved through onboarding PATH_ALIASES). */
  path: string;
};

type ModuleMappingSpec = {
  module: BrainModule;
  title: string;
  summary: string;
  fields: SnapshotFieldSpec[];
  nested?: Array<{ key: string; fields: SnapshotFieldSpec[] }>;
};

/**
 * Snapshot field paths come from QUESTION_BANK in src/ai/onboardingScript.ts.
 * Module keys are constrained to the brain_module Postgres enum
 * (see supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql).
 */
const MODULE_MAPPING_SPECS: ModuleMappingSpec[] = [
  {
    module: "bootstrap",
    title: "Agency Profile (Agency Onboarding)",
    summary: "Agency identity, scale, market focus, and positioning captured during agency onboarding.",
    fields: [
      { key: "agency_name", path: "agency.name" },
      { key: "timezone", path: "agency.timezone" },
      { key: "primary_client_languages", path: "agency.primary_client_languages" },
      { key: "team_size_total", path: "agency.team_size_total" },
      { key: "active_paying_clients", path: "agency.active_paying_clients" },
      { key: "target_industries", path: "agency.top_industries" },
      { key: "website_and_links", path: "agency.website_and_links" },
      { key: "role_counts", path: "agency.role_counts" },
    ],
    nested: [
      {
        key: "positioning",
        fields: [
          { key: "best_client_summary", path: "agency.best_client_summary" },
          { key: "key_differentiators", path: "agency.key_differentiators" },
          { key: "client_type_split", path: "agency.client_type_split" },
          { key: "who_to_avoid", path: "agency.who_to_avoid" },
          { key: "proof_metrics", path: "agency.proof_metrics" },
          { key: "competitor_urls", path: "agency.competitor_urls" },
        ],
      },
    ],
  },
  {
    module: "offer_stack",
    title: "Offers & Pricing (Agency Onboarding)",
    summary: "Service catalog, packaged offers, growth priorities, and pricing captured during agency onboarding.",
    fields: [
      { key: "service_catalog", path: "agency.service_catalog" },
      { key: "top_margin_offers", path: "agency.top_margin_offers" },
      { key: "packaged_offers", path: "agency.packaged_offers" },
      { key: "pricing_model", path: "agency.pricing_model" },
      { key: "price_ranges_by_tier", path: "agency.price_ranges_by_tier" },
    ],
  },
  {
    module: "quality_bar",
    title: "Delivery Standards & Approvals (Agency Onboarding)",
    summary: "Approval workflow, turnaround SLAs, reporting cadence, and delivery requirements captured during agency onboarding.",
    fields: [
      { key: "approval_workflow", path: "operations.approval_workflow" },
      { key: "turnaround_slas", path: "operations.turnaround_slas" },
      { key: "reporting_cadence", path: "operations.reporting_cadence" },
      { key: "required_client_assets", path: "operations.required_client_assets" },
      { key: "tools_stack", path: "operations.tools_stack" },
      { key: "platforms_managed", path: "operations.platforms_managed" },
      { key: "paid_ads_account_access", path: "operations.paid_ads_account_access" },
      { key: "paid_ads_spend_bracket", path: "operations.paid_ads_spend_bracket" },
    ],
  },
  {
    module: "rep_policy",
    title: "Compliance & Communication Boundaries (Agency Onboarding)",
    summary: "Compliance rules and disallowed claims captured during agency onboarding.",
    fields: [{ key: "boundaries", path: "operations.rep_policy_boundaries" }],
  },
  {
    module: "tone_voice",
    title: "AI Voice & Writing Style (Agency Onboarding)",
    summary: "Assistant persona, personality traits, and writing preferences captured during agency onboarding.",
    fields: [
      { key: "assistant_name", path: "ai.persona_name" },
      { key: "role_title", path: "ai.role_title" },
      { key: "personality_traits", path: "ai.personality_traits" },
      { key: "writing_preferences", path: "ai.writing_preferences" },
      { key: "tone_traits", path: "persona.tone_traits" },
      { key: "expertise_traits", path: "persona.expertise_traits" },
    ],
  },
];

function isPopulatedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function readSnapshotField(snapshot: Record<string, unknown>, path: string): unknown {
  const module = path.split(".")[0];
  const value = resolveSnapshotValue(snapshot, module, path);
  return isPopulatedValue(value) ? value : undefined;
}

function collectFields(snapshot: Record<string, unknown>, fields: SnapshotFieldSpec[]) {
  const collected: Record<string, unknown> = {};
  let populated = 0;
  for (const field of fields) {
    const value = readSnapshotField(snapshot, field.path);
    if (value === undefined) continue;
    collected[field.key] = value;
    populated += 1;
  }
  return { collected, populated };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function contentJsonEquals(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * Pure mapping: draft brain snapshot -> brain document payloads.
 * Modules with no populated snapshot fields are omitted.
 */
export function buildAgencyBrainDocumentsFromSnapshot(
  snapshot: Record<string, unknown>
): MappedAgencyBrainDocument[] {
  const documents: MappedAgencyBrainDocument[] = [];

  for (const spec of MODULE_MAPPING_SPECS) {
    const { collected, populated } = collectFields(snapshot, spec.fields);
    let populatedTotal = populated;

    for (const nested of spec.nested ?? []) {
      const nestedResult = collectFields(snapshot, nested.fields);
      if (nestedResult.populated > 0) {
        collected[nested.key] = nestedResult.collected;
        populatedTotal += nestedResult.populated;
      }
    }

    if (populatedTotal === 0) continue;

    documents.push({
      module: spec.module,
      title: spec.title,
      content_json: {
        ...collected,
        summary: spec.summary,
        source: AGENCY_ONBOARDING_CONTENT_SOURCE,
      },
    });
  }

  return documents;
}

/**
 * Materialize the agency onboarding snapshot into approved brain_documents.
 *
 * Never throws for per-module failures; every failure is recorded in the
 * result so onboarding completion is not blocked. Ingestion failures are
 * collected separately and do not fail the document write.
 */
export async function materializeAgencyOnboardingBrainDocuments(opts: {
  supabase: MinimalSupabase;
  agencyId: string;
  userId: string;
  snapshot: Record<string, unknown>;
  ingestBrainDocumentForRag: (supabase: any, doc: BrainDocument) => Promise<unknown>;
  log?: (level: "info" | "error", event: string, payload: Record<string, unknown>) => void;
}): Promise<AgencyOnboardingBrainMaterializeResult> {
  const { supabase, agencyId, userId, snapshot, ingestBrainDocumentForRag } = opts;
  const log = opts.log ?? (() => {});

  const result: AgencyOnboardingBrainMaterializeResult = {
    created: [],
    updated: [],
    skipped: [],
    ingested: [],
    ingest_failed: [],
    errors: [],
  };

  const mappedDocuments = buildAgencyBrainDocumentsFromSnapshot(snapshot);

  for (const mapped of mappedDocuments) {
    try {
      const existingRes: MaybeSingleResult<BrainDocument> = await supabase
        .from("brain_documents")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("module", mapped.module)
        .eq("status", "approved")
        .maybeSingle();

      if (existingRes?.error) {
        throw new Error(existingRes.error.message ?? "Failed to fetch existing brain document");
      }

      const existing = existingRes?.data ?? null;
      let persistedDoc: BrainDocument | null = null;

      if (existing) {
        if (existing.source !== "onboarding") {
          // Document was authored/approved through the Brain UI; never overwrite it.
          result.skipped.push({ module: mapped.module, reason: "manual_document" });
          continue;
        }

        if (contentJsonEquals(existing.content_json ?? {}, mapped.content_json)) {
          result.skipped.push({ module: mapped.module, reason: "unchanged" });
          continue;
        }

        const newVersion = Number(existing.version ?? 1) + 1;
        const updateRes: MaybeSingleResult<BrainDocument> = await supabase
          .from("brain_documents")
          .update({
            title: mapped.title,
            content_json: mapped.content_json,
            version: newVersion,
            approved_at: new Date().toISOString(),
            approved_by: userId,
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (updateRes?.error || !updateRes?.data) {
          throw new Error(updateRes?.error?.message ?? "Failed to update brain document");
        }

        await supabase.from("brain_document_versions").insert({
          document_id: existing.id,
          version: newVersion,
          content_json: mapped.content_json,
          change_summary: "Updated from agency onboarding completion",
          created_by: userId,
        });

        persistedDoc = updateRes.data;
        result.updated.push(mapped.module);
      } else {
        const insertRes: MaybeSingleResult<BrainDocument> = await supabase
          .from("brain_documents")
          .insert({
            agency_id: agencyId,
            module: mapped.module,
            title: mapped.title,
            content_json: mapped.content_json,
            status: "approved",
            source: "onboarding",
            approved_at: new Date().toISOString(),
            approved_by: userId,
            created_by: userId,
          })
          .select("*")
          .single();

        if (insertRes?.error || !insertRes?.data) {
          throw new Error(insertRes?.error?.message ?? "Failed to create brain document");
        }

        await supabase.from("brain_document_versions").insert({
          document_id: insertRes.data.id,
          version: 1,
          content_json: mapped.content_json,
          change_summary: "Created from agency onboarding completion",
          created_by: userId,
        });

        persistedDoc = insertRes.data;
        result.created.push(mapped.module);
      }

      if (persistedDoc) {
        try {
          await ingestBrainDocumentForRag(supabase, persistedDoc);
          result.ingested.push(mapped.module);
        } catch (ingestError) {
          const message = ingestError instanceof Error ? ingestError.message : String(ingestError);
          result.ingest_failed.push(mapped.module);
          log("error", "agency_onboarding_brain_ingest_failed", {
            agencyId,
            module: mapped.module,
            message,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ module: mapped.module, message });
      log("error", "agency_onboarding_brain_materialize_module_failed", {
        agencyId,
        module: mapped.module,
        message,
      });
    }
  }

  log("info", "agency_onboarding_brain_materialized", {
    agencyId,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    ingested: result.ingested,
    ingest_failed: result.ingest_failed,
    error_count: result.errors.length,
  });

  return result;
}
