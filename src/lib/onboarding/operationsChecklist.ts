import type { OnboardingProfile } from "@/types/onboarding";

export type OperationsChecklistStatus = "complete" | "blocked" | "recommended";

export interface OperationsChecklistItem {
  id: string;
  title: string;
  description: string;
  status: OperationsChecklistStatus;
  owner: "Client" | "Agency" | "Shared";
  nextAction: string;
  value?: string;
  blocking: boolean;
}

export interface OperationsChecklistSection {
  id: string;
  title: string;
  items: OperationsChecklistItem[];
}

export interface OperationsChecklistSummary {
  total: number;
  complete: number;
  blocked: number;
  recommended: number;
}

export interface OperationsChecklistResult {
  sections: OperationsChecklistSection[];
  summary: OperationsChecklistSummary;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => hasText(item)) : [];
}

function joinList(values: string[], emptyLabel = "Not provided") {
  return values.length > 0 ? values.join(", ") : emptyLabel;
}

function hasCadence(profile: Partial<OnboardingProfile>) {
  if (hasText(profile.cadence_preset)) return true;
  const cadence = profile.cadence_per_platform ?? profile.q18_cadence;
  return !!cadence && Object.values(cadence).some((value) => typeof value === "number" && value > 0);
}

function getOpsMeta(profile: Partial<OnboardingProfile>) {
  return profile.v5_meta?.operations_setup ?? {};
}

function item(args: {
  id: string;
  title: string;
  description: string;
  owner: "Client" | "Agency" | "Shared";
  nextAction: string;
  blocking: boolean;
  complete: boolean;
  recommended?: boolean;
  value?: string;
}): OperationsChecklistItem {
  const status: OperationsChecklistStatus = args.complete
    ? "complete"
    : args.recommended
      ? "recommended"
      : "blocked";

  return {
    id: args.id,
    title: args.title,
    description: args.description,
    owner: args.owner,
    nextAction: args.nextAction,
    blocking: args.blocking,
    status,
    value: args.value,
  };
}

export function buildOperationsChecklist(profile: Partial<OnboardingProfile> | null | undefined): OperationsChecklistResult {
  const currentProfile = profile ?? {};
  const ops = getOpsMeta(currentProfile);
  const contactRole = hasText(ops.primary_contact_role) ? ` (${ops.primary_contact_role.trim()})` : "";
  const approverRole = hasText(ops.main_approver_role) ? ` (${ops.main_approver_role.trim()})` : "";
  const accessStatus = asStringArray(ops.required_access_status);
  const missingAssets = asStringArray(ops.missing_assets);
  const languages = currentProfile.q4_languages ?? [];
  const formats = currentProfile.formats ?? [];
  const cadencePreset = currentProfile.cadence_preset;

  const sections: OperationsChecklistSection[] = [
    {
      id: "contacts_approvals",
      title: "Contacts and approvals",
      items: [
        item({
          id: "primary_contact",
          title: "Primary contact",
          description: "Named day-to-day contact for delivery questions and file requests.",
          owner: "Client",
          nextAction: "Confirm the operating contact for the account.",
          blocking: true,
          complete: hasText(ops.primary_contact_name),
          value: hasText(ops.primary_contact_name) ? `${ops.primary_contact_name.trim()}${contactRole}` : undefined,
        }),
        item({
          id: "main_approver",
          title: "Main approver",
          description: "Person responsible for sign-off on content, campaigns, or revisions.",
          owner: "Client",
          nextAction: "Confirm who approves work before it goes live.",
          blocking: true,
          complete: hasText(ops.main_approver_name),
          value: hasText(ops.main_approver_name) ? `${ops.main_approver_name.trim()}${approverRole}` : undefined,
        }),
        item({
          id: "approval_sla",
          title: "Approval turnaround",
          description: "Expected review speed so the team can plan publishing cadence safely.",
          owner: "Shared",
          nextAction: "Set the expected approval turnaround for content and campaigns.",
          blocking: false,
          complete: hasText(ops.approval_sla),
          recommended: true,
          value: hasText(ops.approval_sla) ? ops.approval_sla.trim() : undefined,
        }),
        item({
          id: "escalation_contact",
          title: "Escalation path",
          description: "Backup contact if approvals or access requests get stuck.",
          owner: "Shared",
          nextAction: "Add an escalation contact for blocked approvals or urgent issues.",
          blocking: false,
          complete: hasText(ops.escalation_contact),
          recommended: true,
          value: hasText(ops.escalation_contact) ? ops.escalation_contact.trim() : undefined,
        }),
      ],
    },
    {
      id: "delivery_readiness",
      title: "Delivery readiness",
      items: [
        item({
          id: "preferred_comms",
          title: "Preferred communication channel",
          description: "Primary channel the client wants the team to use for day-to-day coordination.",
          owner: "Shared",
          nextAction: "Confirm where communication should happen.",
          blocking: true,
          complete: hasText(ops.preferred_comms_channel),
          value: hasText(ops.preferred_comms_channel) ? ops.preferred_comms_channel.trim() : undefined,
        }),
        item({
          id: "launch_window",
          title: "Launch window",
          description: "Time expectation for first deliverables or go-live motion.",
          owner: "Shared",
          nextAction: "Set the expected launch window or urgency level.",
          blocking: true,
          complete: hasText(ops.launch_window),
          value: hasText(ops.launch_window) ? ops.launch_window.trim() : undefined,
        }),
        item({
          id: "access_readiness",
          title: "Access readiness",
          description: "Visibility into which accounts, logins, and tools are already available.",
          owner: "Client",
          nextAction: "Confirm required platform and account access.",
          blocking: true,
          complete: accessStatus.length > 0,
          value: joinList(accessStatus),
        }),
        item({
          id: "missing_assets",
          title: "Missing assets",
          description: "List of still-needed brand assets, files, or creative inputs.",
          owner: "Client",
          nextAction: "List missing files or confirm there are no pending assets.",
          blocking: true,
          complete: Array.isArray(ops.missing_assets),
          value: joinList(missingAssets, "No missing assets listed"),
        }),
        item({
          id: "response_handling",
          title: "Lead and DM handling",
          description: "Clarifies who responds when leads, DMs, or comments start coming in.",
          owner: "Shared",
          nextAction: "Decide who handles incoming responses once campaigns are live.",
          blocking: true,
          complete: hasText(currentProfile.response_handling),
          value: hasText(currentProfile.response_handling) ? currentProfile.response_handling.replace(/_/g, " ") : undefined,
        }),
      ],
    },
    {
      id: "production_inputs",
      title: "Production inputs",
      items: [
        item({
          id: "languages",
          title: "Operating languages",
          description: "Languages the team should use for copy, scripts, and publishing.",
          owner: "Shared",
          nextAction: "Confirm the working language set.",
          blocking: false,
          complete: languages.length > 0,
          recommended: true,
          value: joinList(languages),
        }),
        item({
          id: "formats",
          title: "Content formats",
          description: "Preferred deliverable types so production starts in the right format.",
          owner: "Agency",
          nextAction: "Set preferred content formats for this client.",
          blocking: false,
          complete: formats.length > 0,
          recommended: true,
          value: joinList(formats),
        }),
        item({
          id: "cadence",
          title: "Cadence expectation",
          description: "Posting frequency or pacing for content planning.",
          owner: "Agency",
          nextAction: "Define the initial cadence expectation.",
          blocking: false,
          complete: hasCadence(currentProfile),
          recommended: true,
          value: hasText(cadencePreset) ? cadencePreset.replace(/_/g, " ") : undefined,
        }),
        item({
          id: "on_camera",
          title: "On-camera availability",
          description: "Determines whether production depends on the owner, team, or faceless formats.",
          owner: "Client",
          nextAction: "Confirm who can appear on camera.",
          blocking: false,
          complete: hasText(currentProfile.on_camera_availability),
          recommended: true,
          value: hasText(currentProfile.on_camera_availability) ? currentProfile.on_camera_availability.replace(/_/g, " ") : undefined,
        }),
      ],
    },
  ];

  const items = sections.flatMap((section) => section.items);
  return {
    sections,
    summary: {
      total: items.length,
      complete: items.filter((entry) => entry.status === "complete").length,
      blocked: items.filter((entry) => entry.status === "blocked").length,
      recommended: items.filter((entry) => entry.status === "recommended").length,
    },
  };
}
