import type { BrainDocument } from "@/lib/ai/brainDocuments";

export type ModuleStatus = "not-started" | "draft" | "active" | "error";

export interface StatusConfig {
  icon: string;
  label: string;
  colorClass: string;
  bgClass: string;
}

export const STATUS_CONFIG: Record<ModuleStatus, StatusConfig> = {
  "not-started": {
    icon: "○",
    label: "Not Started",
    colorClass: "text-slate-400",
    bgClass: "bg-slate-700/40",
  },
  draft: {
    icon: "◐",
    label: "Draft",
    colorClass: "text-amber-300",
    bgClass: "bg-amber-500/15",
  },
  active: {
    icon: "✓",
    label: "Active",
    colorClass: "text-emerald-300",
    bgClass: "bg-emerald-500/15",
  },
  error: {
    icon: "⚠️",
    label: "Needs Attention",
    colorClass: "text-red-300",
    bgClass: "bg-red-500/15",
  },
};

/**
 * Compute display status from document state + ingestion health.
 * `hasIngestionError` should only be true when the AI cannot use the content.
 */
export function computeDisplayStatus(document: BrainDocument | null, hasIngestionError: boolean): ModuleStatus {
  if (!document) return "not-started";

  if (document.status === "approved") {
    return hasIngestionError ? "error" : "active";
  }

  // "draft" or "pending_approval" -> show as draft
  return "draft";
}

