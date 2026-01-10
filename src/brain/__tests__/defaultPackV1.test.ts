import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAIN_PACK_V1,
  renderDefaultBrainPackV1,
  renderTemplate,
  type AgencyTemplateFields,
} from "@/brain/defaultPackV1";

function sortedKeys(value: Record<string, unknown>) {
  return Object.keys(value).sort();
}

function expectExactKeys(value: Record<string, unknown>, expectedKeys: string[]) {
  expect(sortedKeys(value)).toEqual([...expectedKeys].sort());
}

describe("default brain pack v1", () => {
  it("exports exactly 3 docs with the required modules", () => {
    expect(DEFAULT_BRAIN_PACK_V1).toHaveLength(3);
    const modules = DEFAULT_BRAIN_PACK_V1.map((d) => d.module).sort();
    expect(modules).toEqual(["bootstrap", "quality_bar", "rep_policy"]);
  });

  it("templates match editor content_json shapes exactly", () => {
    const bootstrap = DEFAULT_BRAIN_PACK_V1.find((d) => d.module === "bootstrap");
    const rep = DEFAULT_BRAIN_PACK_V1.find((d) => d.module === "rep_policy");
    const quality = DEFAULT_BRAIN_PACK_V1.find((d) => d.module === "quality_bar");
    if (!bootstrap || !rep || !quality) throw new Error("Missing required modules");

    expectExactKeys(bootstrap.content_json, [
      "agency_name",
      "niche",
      "website",
      "positioning",
      "services",
      "ideal_client_profile",
      "pain_points",
      "unique_value_proposition",
      "target_industries",
    ]);

    expectExactKeys(rep.content_json, [
      "ai_name",
      "persona",
      "response_sla",
      "can_do",
      "cannot_do",
      "escalation_triggers",
      "never_say",
      "response_templates",
      "tone_guidelines",
    ]);

    expectExactKeys(quality.content_json, [
      "review_criteria",
      "minimum_score",
      "critical_criteria",
      "non_negotiables",
      "revision_policy",
      "escalation_triggers",
      "qa_steps",
    ]);
  });
});

describe("renderTemplate", () => {
  const fields: AgencyTemplateFields = {
    agency_name: "Acme Agency",
    agency_website: "https://acme.example",
    agency_niche: "Generalist",
  };

  it("replaces placeholders recursively across objects and arrays", () => {
    const input = {
      a: "{{agency_name}}",
      b: ["{{agency_website}}", { c: "({{agency_niche}})" }],
      d: 123,
      e: true,
      f: null as null,
    };

    const output = renderTemplate(input, fields);
    expect(output).toEqual({
      a: "Acme Agency",
      b: ["https://acme.example", { c: "(Generalist)" }],
      d: 123,
      e: true,
      f: null,
    });
  });

  it("does not mutate the input object", () => {
    const input = { a: "{{agency_name}}", nested: { b: ["{{agency_website}}"] } };
    const snapshot = JSON.parse(JSON.stringify(input)) as typeof input;
    renderTemplate(input, fields);
    expect(input).toEqual(snapshot);
  });
});

describe("renderDefaultBrainPackV1", () => {
  it("renders placeholders and leaves no template tokens behind", () => {
    const rendered = renderDefaultBrainPackV1({
      agency_name: "Acme Agency",
      agency_website: "https://acme.example",
      agency_niche: "Generalist",
    });

    const allStrings: string[] = [];
    const collect = (value: unknown) => {
      if (typeof value === "string") allStrings.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(collect);
    };

    rendered.forEach((doc) => {
      collect(doc.title);
      collect(doc.content_json);
    });

    const joined = allStrings.join("\n");
    expect(joined).not.toContain("{{agency_name}}");
    expect(joined).not.toContain("{{agency_website}}");
    expect(joined).not.toContain("{{agency_niche}}");
  });
});

