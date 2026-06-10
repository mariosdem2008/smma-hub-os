import { describe, expect, it, vi } from "vitest";
import { composeGovernance } from "../../_shared/answer-grading.ts";
import {
  buildDeterministicReportInsight,
  buildKpiEvidencePhrases,
  buildReportNarrativeText,
  generateStructuredReportInsight,
  governReportInsight,
  normalizeReportInsightOutput,
  reportInsightToLegacyStrings,
  type ReportInsightContext,
} from "../report-insight.ts";

function baseContext(): ReportInsightContext {
  return {
    month: "2026-05",
    client: {
      id: "client-1",
      name: "Acme Studio",
      company: "Acme Studio LLC",
      niche: "fitness coaching",
    },
    kpis: {
      followersStart: 1_000,
      followersEnd: 1_100,
      followersGrowth: 10,
      postsCount: 8,
      totalImpressions: 12_000,
      totalReach: 8_500,
      totalEngagement: 680,
      avgEngagementRate: 8,
      profileVisits: 240,
    },
    topPosts: [
      {
        platform: "instagram",
        platform_post_id: "post-1",
        date: "2026-05-12",
        impressions: 3_100,
        reach: 2_000,
        engagement: 260,
        engagementRate: 13,
      },
    ],
    strategy: {
      sources: ["strategy_modules:pillars"],
      positioning: "Proof-led coaching for busy professionals.",
      primary_goal: "book more consultation calls",
      funnel: "Instagram profile to booking page",
      pillars: ["client proof", "education"],
      offers: ["12-week coaching program"],
      channels: ["instagram"],
      constraints: ["Avoid guaranteed transformation claims."],
      notes: ["Audience: busy professionals"],
    },
    delivery: {
      source: "client_blockers",
      delivery_state: "blocked",
      blockers: [
        {
          code: "approval_stalled",
          severity: "high",
          title: "Client approval is stalled",
          detail: "One project has been in client review for more than 48 hours.",
          owner: "client",
          recommended_next_action: "Send an approval follow-up to the client approver.",
        },
      ],
      counts: { high: 1, med: 0, blocked: 1 },
      scanned_at: "2026-06-10T12:00:00.000Z",
    },
    governanceSummary: {
      tone_rules: ["Specific, calm, no hype."],
      banned_claims: [{ text: "guaranteed results", source: "agency" }],
    },
    governance: null,
  };
}

describe("monthly report insight", () => {
  it("uses a deterministic grounded fallback when no local provider is configured", async () => {
    const context = baseContext();
    const aiRunner = vi.fn();

    const result = await generateStructuredReportInsight({
      context,
      aiContext: { agencyId: "agency-1", clientId: "client-1", userId: "user-1" },
      aiRunner,
      localLlmConfigured: false,
    });

    expect(result.source).toBe("deterministic");
    expect(result.fallbackReason).toBe("local_llm_not_configured");
    expect(aiRunner).not.toHaveBeenCalled();

    const evidencePhrases = buildKpiEvidencePhrases(context);
    expect(result.insight.insights.length).toBeGreaterThan(0);
    for (const insight of result.insight.insights) {
      const combined = `${insight.point} ${insight.evidence}`;
      expect(evidencePhrases.some((phrase) => combined.includes(phrase))).toBe(true);
    }
  });

  it("accepts structured AI JSON only when every insight is grounded in a real KPI phrase", async () => {
    const context = baseContext();
    const phrases = buildKpiEvidencePhrases(context);
    const aiRunner = vi.fn(async () => ({
      text: "{}",
      output: {
        headline: "May performance created a useful content read.",
        performance_summary: "Based on the KPI table, the month gives the team a clear engagement signal.",
        insights: [
          {
            point: "The strongest creative read came from the top post.",
            evidence: phrases.find((phrase) => phrase.startsWith("top post")) ?? phrases[0],
          },
        ],
        recommendations: [
          {
            action: "Brief one follow-up concept around client proof.",
            why: `This ties the approved pillar to ${phrases.find((phrase) => phrase.includes("engagement rate"))}.`,
            owner: "agency",
          },
        ],
        risks_or_blockers: ["Client approval is stalled."],
      },
      schemaOk: true,
      unknown: false,
      meta: { provider: "openai", model: "qwen2.5:7b-instruct" },
    }));

    const result = await generateStructuredReportInsight({
      context,
      aiContext: { agencyId: "agency-1", clientId: "client-1", userId: "user-1" },
      aiRunner,
      localLlmConfigured: true,
    });

    expect(result.source).toBe("ai");
    expect(result.model).toBe("qwen2.5:7b-instruct");

    const legacy = reportInsightToLegacyStrings(result.insight);
    expect(legacy.insights).toContain("Evidence:");
    expect(legacy.recommendations).toContain("Owner: agency");
  });

  it("falls back when AI JSON is schema-valid but not KPI-grounded", () => {
    const context = baseContext();
    const normalized = normalizeReportInsightOutput(
      {
        headline: "May performance was strong.",
        performance_summary: "This was a strong month.",
        insights: [{ point: "Engagement improved.", evidence: "The audience responded well." }],
        recommendations: [{ action: "Post more.", why: "It will help.", owner: "agency" }],
        risks_or_blockers: [],
      },
      context,
    );

    expect(normalized.insight).toBeNull();
    expect(normalized.reason).toContain("ungrounded");
  });

  it("blocks banned-claim narratives, persists grading, and returns a clean fallback", async () => {
    const governance = composeGovernance({
      agency: {
        banned_claims: ["guaranteed results"],
      },
    });
    const context = { ...baseContext(), governance };
    const candidate = {
      ...buildDeterministicReportInsight(context),
      headline: "Guaranteed results from May performance.",
    };
    const persistAiGrading = vi.fn(async () => ({ ok: true, error: null }));

    const governed = await governReportInsight({
      candidate,
      context,
      governance,
      supabase: {},
      agencyId: "agency-1",
      clientId: "client-1",
      createdBy: "user-1",
      aiContext: { agencyId: "agency-1", clientId: "client-1", userId: "user-1" },
      runLlmJudge: false,
      persistAiGrading,
    });

    expect(governed.blockedByGovernance).toBe(true);
    expect(governed.initialGrading.hard_violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "banned_claim" })]),
    );
    expect(buildReportNarrativeText(governed.insight).toLowerCase()).not.toContain("guaranteed results");
    expect(persistAiGrading).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "generate-monthly-report",
        contentType: "monthly_report",
        result: expect.objectContaining({
          hard_violations: expect.arrayContaining([expect.objectContaining({ code: "banned_claim" })]),
        }),
      }),
    );
  });
});
