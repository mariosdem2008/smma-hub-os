import { describe, expect, it } from "vitest";
import {
  buildApprovalNotificationIdempotencyKey,
  getApprovalReminderDedupeSince,
  shouldSendApprovalReminder,
} from "@/lib/approvalNotifications";

describe("approval notification idempotency", () => {
  it("builds a stable event/day key for project approval notifications", () => {
    const input = {
      action: "approval_reminder",
      projectId: "A72E4580-1111-4444-9999-E1F88E0B5A10",
      day: "2026-06-10T23:59:00.000Z",
    };

    expect(buildApprovalNotificationIdempotencyKey(input)).toBe(
      "approval-notification:approval_reminder:project:a72e4580-1111-4444-9999-e1f88e0b5a10:2026-06-10",
    );
    expect(buildApprovalNotificationIdempotencyKey(input)).toBe(buildApprovalNotificationIdempotencyKey(input));
  });

  it("changes the key when the action or UTC day changes", () => {
    const base = {
      projectId: "project-1",
      action: "approval_reminder",
      day: "2026-06-10T12:00:00.000Z",
    };

    expect(buildApprovalNotificationIdempotencyKey(base)).not.toBe(
      buildApprovalNotificationIdempotencyKey({ ...base, action: "approved" }),
    );
    expect(buildApprovalNotificationIdempotencyKey(base)).not.toBe(
      buildApprovalNotificationIdempotencyKey({ ...base, day: "2026-06-11T00:00:00.000Z" }),
    );
  });
});

describe("approval reminder dedupe", () => {
  it("allows first send and blocks reminders inside the 24 hour window", () => {
    const now = "2026-06-10T18:00:00.000Z";

    expect(shouldSendApprovalReminder({ now, lastSentAt: null })).toBe(true);
    expect(shouldSendApprovalReminder({ now, lastSentAt: "2026-06-09T18:00:01.000Z" })).toBe(false);
  });

  it("allows a reminder once the 24 hour window has elapsed", () => {
    expect(
      shouldSendApprovalReminder({
        now: "2026-06-10T18:00:00.000Z",
        lastSentAt: "2026-06-09T18:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("returns the exact rolling dedupe boundary", () => {
    expect(getApprovalReminderDedupeSince("2026-06-10T18:00:00.000Z").toISOString()).toBe(
      "2026-06-09T18:00:00.000Z",
    );
  });
});
