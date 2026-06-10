import { describe, expect, it } from "vitest";
import { detectClientBlockers } from "../blocker-detection.ts";

const NOW = "2026-06-10T12:00:00.000Z";

describe("blocker detection", () => {
  it("handles empty inputs without inventing blockers", () => {
    const result = detectClientBlockers({ now: NOW });

    expect(result.delivery_state).toBe("on_track");
    expect(result.blockers).toEqual([]);
    expect(result.counts).toEqual({ high: 0, med: 0, blocked: 0 });
  });

  it("returns on_track for a client with clear deterministic signals", () => {
    const result = detectClientBlockers({
      clientId: "client-1",
      now: NOW,
      brainStatus: { usable: true, missing_fields: [], missing_fields_count: 0 },
      operationsSetup: {
        setup_status: "ready",
        primary_contact_name: "Alex",
        primary_contact_email: "alex@example.com",
        main_approver_name: "Morgan",
        required_access_status: ["Meta connected", "Google Drive connected"],
      },
      enrichmentQueue: [
        { status: "resolved", title: "Old question", priority: "high" },
      ],
      executionTasks: [
        { status: "done", title: "Resolved task", priority: "urgent", due_at: "2026-06-01T12:00:00.000Z" },
      ],
      projects: [
        {
          title: "Recent production item",
          status: "production",
          last_moved_at: "2026-06-08T12:00:00.000Z",
        },
      ],
      strategyState: {
        onboardingComplete: true,
        hasApprovedStrategy: true,
      },
    });

    expect(result.delivery_state).toBe("on_track");
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks delivery for missing brain fields, stalled client review, and overdue execution tasks", () => {
    const result = detectClientBlockers({
      clientId: "client-1",
      now: NOW,
      brainStatus: {
        usable: false,
        missing_fields: ["brand_basics.name", "goals"],
        missing_fields_count: 2,
      },
      operationsSetup: {
        setup_status: "ready",
        primary_contact_name: "Alex",
        main_approver_name: "Morgan",
        required_access_status: ["Meta connected"],
      },
      executionTasks: [
        {
          title: "Upload source files",
          status: "todo",
          priority: "high",
          due_at: "2026-06-09T12:00:00.000Z",
        },
      ],
      projects: [
        {
          title: "June ad creative",
          status: "client_review",
          last_moved_at: "2026-06-07T12:00:00.000Z",
        },
      ],
      strategyState: { onboardingComplete: false, hasApprovedStrategy: false },
    });

    expect(result.delivery_state).toBe("blocked");
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(
      expect.arrayContaining(["client_brain_incomplete", "approval_stalled", "execution_tasks_blocked"]),
    );
    expect(result.blockers.find((blocker) => blocker.code === "client_brain_incomplete")?.owner).toBe("client");
    expect(result.blockers.find((blocker) => blocker.code === "approval_stalled")?.owner).toBe("client");
    expect(result.blockers.find((blocker) => blocker.code === "execution_tasks_blocked")?.owner).toBe("agency");
    expect(result.counts.high).toBeGreaterThanOrEqual(3);
    expect(result.counts.blocked).toBe(result.counts.high);
  });

  it("treats approval SLA as a strict greater-than 48 hour boundary", () => {
    const boundary = detectClientBlockers({
      clientId: "client-1",
      now: NOW,
      projects: [
        {
          title: "Boundary approval",
          status: "client_review",
          last_moved_at: "2026-06-08T12:00:00.000Z",
        },
      ],
    });

    expect(boundary.blockers.some((blocker) => blocker.code === "approval_stalled")).toBe(false);

    const beyondBoundary = detectClientBlockers({
      clientId: "client-1",
      now: NOW,
      projects: [
        {
          title: "Late approval",
          status: "client_review",
          last_moved_at: "2026-06-08T11:59:59.999Z",
        },
      ],
    });

    expect(beyondBoundary.blockers.some((blocker) => blocker.code === "approval_stalled")).toBe(true);
  });

  it("routes operations setup gaps to the owner", () => {
    const result = detectClientBlockers({
      clientId: "client-1",
      now: NOW,
      brainStatus: { usable: true, missing_fields: [], missing_fields_count: 0 },
      operationsSetup: {
        setup_status: "in_progress",
        primary_contact_name: "",
        main_approver_name: "",
        required_access_status: [],
      },
    });

    const setupBlocker = result.blockers.find((blocker) => blocker.code === "operations_setup_incomplete");
    expect(setupBlocker?.owner).toBe("owner");
    expect(setupBlocker?.detail).toContain("primary contact");
    expect(setupBlocker?.detail).toContain("main approver");
    expect(setupBlocker?.detail).toContain("platform access");
  });

  it("blocks execution-ready clients without an approved strategy", () => {
    const result = detectClientBlockers({
      clientId: "client-1",
      now: NOW,
      strategyState: {
        onboardingComplete: true,
        strategies: [{ id: "strategy-1", status: "active", locked_at: null }],
        approvedModuleCount: 0,
        approvedArtifactCount: 0,
      },
    });

    expect(result.delivery_state).toBe("blocked");
    expect(result.blockers.find((blocker) => blocker.code === "strategy_not_approved")?.owner).toBe("agency");
  });
});
