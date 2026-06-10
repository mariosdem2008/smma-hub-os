const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ApprovalNotificationAction =
  | "submitted"
  | "approved"
  | "rejected"
  | "approval_requested"
  | "changes_requested"
  | "approval_reminder";

export interface ApprovalNotificationKeyInput {
  action: ApprovalNotificationAction | string;
  projectId?: string | null;
  assetId?: string | null;
  contentType?: string | null;
  contentId?: string | null;
  clientId?: string | null;
  day?: string | Date;
}

export function getUtcDayBucket(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date for approval notification day bucket");
  }
  return date.toISOString().slice(0, 10);
}

function normalizeKeyPart(value: string | null | undefined, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
}

export function buildApprovalNotificationIdempotencyKey(input: ApprovalNotificationKeyInput): string {
  const day = typeof input.day === "string" ? getUtcDayBucket(input.day) : getUtcDayBucket(input.day ?? new Date());
  const subject =
    input.projectId
      ? `project:${normalizeKeyPart(input.projectId, "unknown")}`
      : input.assetId
        ? `asset:${normalizeKeyPart(input.assetId, "unknown")}`
        : input.contentId
          ? `content:${normalizeKeyPart(input.contentType, "content")}:${normalizeKeyPart(input.contentId, "unknown")}`
          : input.clientId
            ? `client:${normalizeKeyPart(input.clientId, "unknown")}`
            : "subject:unknown";

  return [
    "approval-notification",
    normalizeKeyPart(input.action, "unknown-action"),
    subject,
    day,
  ].join(":");
}

export function getApprovalReminderDedupeSince(now: string | Date = new Date()): Date {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date for approval reminder dedupe window");
  }
  return new Date(date.getTime() - REMINDER_WINDOW_MS);
}

export function shouldSendApprovalReminder(input: {
  now?: string | Date;
  lastSentAt?: string | Date | null;
}): boolean {
  if (!input.lastSentAt) return true;
  const now = input.now instanceof Date ? input.now : new Date(input.now ?? new Date());
  const lastSentAt = input.lastSentAt instanceof Date ? input.lastSentAt : new Date(input.lastSentAt);
  if (Number.isNaN(now.getTime()) || Number.isNaN(lastSentAt.getTime())) {
    throw new Error("Invalid date for approval reminder dedupe check");
  }
  return now.getTime() - lastSentAt.getTime() >= REMINDER_WINDOW_MS;
}
