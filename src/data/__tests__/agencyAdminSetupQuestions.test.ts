import { describe, expect, it } from "vitest";
import {
  computeSmartProgress,
  evaluateDependencies,
  getQuestionByKey,
  type SetupQuestion,
} from "../../../supabase/functions/_shared/agency-admin-setup-questions";

describe("agency admin setup questions", () => {
  it("skips deliverables when services do not match required_if", () => {
    const question = getQuestionByKey("agency.deliverables_standard");
    expect(question).not.toBeNull();
    const answeredValues = new Map<string, unknown>([
      ["agency.primary_services", ["Paid ads management"]],
    ]);

    const result = evaluateDependencies(question as SetupQuestion, answeredValues);
    expect(result.shouldShow).toBe(false);
  });

  it("shows deliverables when required_if matches", () => {
    const question = getQuestionByKey("agency.deliverables_standard");
    expect(question).not.toBeNull();
    const answeredValues = new Map<string, unknown>([
      ["agency.primary_services", ["Content creation"]],
    ]);

    const result = evaluateDependencies(question as SetupQuestion, answeredValues);
    expect(result.shouldShow).toBe(true);
  });

  it("skips brand dos/donts when skip_if matches", () => {
    const question = getQuestionByKey("brand.dos_donts");
    expect(question).not.toBeNull();
    const answeredValues = new Map<string, unknown>([
      ["agency.primary_services", ["Paid ads management"]],
    ]);

    const result = evaluateDependencies(question as SetupQuestion, answeredValues);
    expect(result.shouldShow).toBe(false);
  });

  it("supports numeric conditions", () => {
    const question: SetupQuestion = {
      key: "numeric.test",
      question_text: "How many team members?",
      expects: "text",
      target_path: "setup_profile_v1.agency.team_size",
      dependencies: {
        required_if: [{ field: "agency.team_size", greaterThan: 5 }],
        skip_if: [{ field: "agency.team_size", lessThan: 2 }],
      },
    };

    const answeredValues = new Map<string, unknown>([
      ["agency.team_size", 1],
    ]);
    const skipped = evaluateDependencies(question, answeredValues);
    expect(skipped.shouldShow).toBe(false);

    const allowed = evaluateDependencies(question, new Map([["agency.team_size", 6]]));
    expect(allowed.shouldShow).toBe(true);
  });

  it("computeSmartProgress excludes skipped questions", () => {
    const answeredKeys = new Set<string>([
      "agency.primary_services",
      "agency.niche_industries",
      "agency.target_client_profile",
      "agency.core_offer_outcome",
    ]);

    const answeredValues = new Map<string, unknown>([
      ["agency.primary_services", ["Paid ads management"]],
    ]);

    const progress = computeSmartProgress(answeredKeys, answeredValues);
    expect(progress).toBe(40);
  });
});
