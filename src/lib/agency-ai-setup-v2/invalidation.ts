import type { AgencyAiSetupAgentClass } from "./config";
import type { AgencyAiSetupMetaV2 } from "./readiness";
import type {
  AgencyAiCertificationV2Record,
  AgencyAiSetupStatusV2Record,
  AgencyAgentUnlockV2Record,
} from "@/hooks/useAgencyAiSetupV2";
import type { AgencyOperatingModuleV2Record } from "@/hooks/useAgencyOperatingModulesV2";

type EvidenceEntry = {
  label: string;
  timestamp: string;
};

export type AgencyAiCertificationInvalidationSummary = {
  agentClass: AgencyAiSetupAgentClass;
  staleCertifications: AgencyAiCertificationV2Record[];
  staleScenarioKeys: string[];
  staleReasons: string[];
  staleSince: string | null;
  latestRelevantEvidenceAt: string | null;
};

export type AgencyAiSetupInvalidationState = Record<
  AgencyAiSetupAgentClass,
  AgencyAiCertificationInvalidationSummary
>;

function toMillis(value: string | null | undefined) {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function buildSectionEvidence(agentClass: AgencyAiSetupAgentClass, meta: AgencyAiSetupMetaV2 | null | undefined) {
  const evidence: EvidenceEntry[] = [];
  if (!meta) return evidence;

  const add = (label: string, timestamp: string | null | undefined) => {
    if (!timestamp) return;
    evidence.push({ label, timestamp });
  };

  if (agentClass === "strategy") {
    add("Imports were updated", meta.imports?.imported_at);
    add("Foundations were updated", meta.foundations?.updated_at);
  }

  if (agentClass === "creator") {
    add("Foundations were updated", meta.foundations?.updated_at);
    add("Guardrails were updated", meta.guardrails?.updated_at);
  }

  if (agentClass === "operator") {
    add("Workflow was updated", meta.workflow?.updated_at);
  }

  if (agentClass === "analyst") {
    add("Foundations were updated", meta.foundations?.updated_at);
    add("Workflow was updated", meta.workflow?.updated_at);
  }

  if (agentClass === "client_facing") {
    add("Foundations were updated", meta.foundations?.updated_at);
    add("Guardrails were updated", meta.guardrails?.updated_at);
    add("Workflow was updated", meta.workflow?.updated_at);
  }

  return evidence;
}

export function deriveAgencyAiSetupInvalidationState({
  status,
  certifications,
  unlocks,
  modules,
}: {
  status: AgencyAiSetupStatusV2Record | null | undefined;
  certifications: AgencyAiCertificationV2Record[];
  unlocks: AgencyAgentUnlockV2Record[];
  modules: Iterable<AgencyOperatingModuleV2Record>;
}): AgencyAiSetupInvalidationState {
  const meta = ((status?.meta_json ?? {}) as AgencyAiSetupMetaV2) || {};
  const moduleMap = new Map(Array.from(modules).map((module) => [module.module_key, module]));
  const agentClasses: AgencyAiSetupAgentClass[] = ["strategy", "creator", "operator", "analyst", "client_facing"];

  return Object.fromEntries(
    agentClasses.map((agentClass) => {
      const unlock = unlocks.find((row) => row.agent_class === agentClass);
      const evidence = buildSectionEvidence(agentClass, meta);

      for (const moduleKey of unlock?.required_modules ?? []) {
        const moduleRecord = moduleMap.get(moduleKey);
        if (!moduleRecord?.updated_at) continue;
        evidence.push({
          label: `${moduleKey.replace(/_/g, " ")} module was updated`,
          timestamp: moduleRecord.updated_at,
        });
      }

      const latestRelevantEvidenceAt =
        evidence.length > 0
          ? evidence.reduce((latest, entry) => {
              const current = toMillis(entry.timestamp);
              const previous = toMillis(latest);
              return Number.isFinite(current) && (!Number.isFinite(previous) || current > previous)
                ? entry.timestamp
                : latest;
            }, evidence[0]?.timestamp ?? null)
          : null;

      const staleCertifications = certifications.filter((certification) => {
        if (certification.agent_class !== agentClass || certification.certification_state !== "certified" || !certification.certified_at) {
          return false;
        }
        const certifiedAt = toMillis(certification.certified_at);
        return evidence.some((entry) => toMillis(entry.timestamp) > certifiedAt);
      });

      const staleReasons = uniqueStrings(
        staleCertifications.flatMap((certification) => {
          const certifiedAt = toMillis(certification.certified_at);
          return evidence
            .filter((entry) => toMillis(entry.timestamp) > certifiedAt)
            .map((entry) => entry.label);
        }),
      );
      const staleScenarioKeys = uniqueStrings(staleCertifications.map((certification) => certification.scenario_key));

      const staleSince =
        staleCertifications.length > 0
          ? staleCertifications.reduce((latest, certification) => {
              const certifiedAt = certification.certified_at;
              if (!certifiedAt) return latest;
              const current = toMillis(certifiedAt);
              const previous = toMillis(latest);
              return Number.isFinite(current) && (!Number.isFinite(previous) || current > previous)
                ? certifiedAt
                : latest;
            }, staleCertifications[0]?.certified_at ?? null)
          : null;

      return [
        agentClass,
        {
          agentClass,
          staleCertifications,
          staleScenarioKeys,
          staleReasons,
          staleSince,
          latestRelevantEvidenceAt,
        },
      ];
    }),
  ) as AgencyAiSetupInvalidationState;
}
