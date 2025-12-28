export type AdminChatPlaybook = "core_offer" | "strategy" | "copywriting";

export type AdminChatStrategicOutput = {
  playbook: AdminChatPlaybook;
  clarifying_questions: string[];
  assumptions?: string[];
  core_offer?: {
    icp_primary: string;
    icp_secondary: string[];
    pain_promise: string;
    offer_mechanism: string;
    tiers: Array<{
      name: string;
      price_range: string;
      deliverables: string[];
      timeline_days: number;
    }>;
    process_timeline: string[];
    pricing_guidance: string;
    risk_reversal: string[];
    client_inputs: string[];
    proof_options: string[];
    proof_collection_7d: string;
    next_action: string;
  } | null;
  strategy?: {
    goal_metric: string;
    funnel_map: string[];
    content_pillars: string[];
    content_ideas: string[];
    experiments: string[];
    next_action: string;
  } | null;
  copywriting?: {
    hooks: string[];
    ad_scripts: string[];
    ctas: string[];
    next_action: string;
  } | null;
  unknown?: { missing: string[]; question: string } | null;
  suggestions?: string[];
};

export type ValidationResult = { ok: boolean; errors?: string[] };

type ScoredPhrase = { phrase: string; weight: number; wordBoundary?: boolean };

const PLAYBOOK_SCORES: Record<AdminChatPlaybook, ScoredPhrase[]> = {
  core_offer: [
    { phrase: "core offer", weight: 4 },
    { phrase: "offer", weight: 2, wordBoundary: true },
    { phrase: "package", weight: 2, wordBoundary: true },
    { phrase: "pricing", weight: 3, wordBoundary: true },
    { phrase: "retainer", weight: 3, wordBoundary: true },
    { phrase: "positioning", weight: 2, wordBoundary: true },
    { phrase: "service menu", weight: 3 },
    { phrase: "tiers", weight: 2, wordBoundary: true },
    { phrase: "guarantee", weight: 1, wordBoundary: true },
  ],
  strategy: [
    { phrase: "strategy", weight: 3, wordBoundary: true },
    { phrase: "growth plan", weight: 3 },
    { phrase: "campaign", weight: 2, wordBoundary: true },
    { phrase: "funnel", weight: 3, wordBoundary: true },
    { phrase: "content pillars", weight: 3 },
    { phrase: "content plan", weight: 2 },
    { phrase: "calendar", weight: 2, wordBoundary: true },
    { phrase: "roadmap", weight: 2, wordBoundary: true },
  ],
  copywriting: [
    { phrase: "copywriting", weight: 3, wordBoundary: true },
    { phrase: "ad scripts", weight: 3, wordBoundary: true },
    { phrase: "ad script", weight: 3, wordBoundary: true },
    { phrase: "hooks", weight: 2, wordBoundary: true },
    { phrase: "headline", weight: 2, wordBoundary: true },
    { phrase: "caption", weight: 2, wordBoundary: true },
    { phrase: "ctas", weight: 2, wordBoundary: true },
    { phrase: "cta", weight: 2, wordBoundary: true },
    { phrase: "creative brief", weight: 2 },
    { phrase: "script", weight: 1, wordBoundary: true },
  ],
};

function scorePlaybook(message: string, phrases: ScoredPhrase[]) {
  const normalized = message.toLowerCase();
  let score = 0;
  for (const entry of phrases) {
    if (entry.wordBoundary) {
      const regex = new RegExp(`\\b${entry.phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(normalized)) score += entry.weight;
    } else if (normalized.includes(entry.phrase)) {
      score += entry.weight;
    }
  }
  return score;
}

export function routeAdminChatPlaybook(message: string): AdminChatPlaybook {
  const scores = (Object.keys(PLAYBOOK_SCORES) as AdminChatPlaybook[]).map((playbook) => ({
    playbook,
    score: scorePlaybook(message, PLAYBOOK_SCORES[playbook]),
  }));

  const maxScore = Math.max(...scores.map((item) => item.score));
  if (maxScore <= 0) return "core_offer";

  const priority: AdminChatPlaybook[] = ["core_offer", "strategy", "copywriting"];
  const best = scores
    .filter((item) => item.score === maxScore)
    .sort((a, b) => priority.indexOf(a.playbook) - priority.indexOf(b.playbook))[0];
  return best?.playbook ?? "core_offer";
}

export function clampClarifyingQuestions(questions: string[]): string[] {
  if (!Array.isArray(questions)) return [];
  return questions.filter((q) => typeof q === "string" && q.trim().length > 0).slice(0, 3);
}

export function validateStrategicOutput(output: unknown): ValidationResult {
  const errors: string[] = [];
  if (!output || typeof output !== "object") {
    return { ok: false, errors: ["Output must be an object"] };
  }

  {
    const output = output as AdminChatStrategicOutput;

  const playbooks: AdminChatPlaybook[] = ["core_offer", "strategy", "copywriting"];
  if (!playbooks.includes(output.playbook)) {
    errors.push("playbook must be core_offer, strategy, or copywriting");
  }

  if (!Array.isArray(output.clarifying_questions)) {
    errors.push("clarifying_questions must be an array of strings");
  } else {
    if (output.clarifying_questions.length > 3) {
      errors.push("clarifying_questions must have <= 3 items");
    }
    output.clarifying_questions.forEach((item, index) => {
      if (typeof item !== "string" || !item.trim()) {
        errors.push(`clarifying_questions[${index}] must be a non-empty string`);
      } else if (item.trim().length > 160) {
        errors.push(`clarifying_questions[${index}] must be <= 160 chars`);
      }
    });
  }

  if (output.suggestions) {
    if (!Array.isArray(output.suggestions)) {
      errors.push("suggestions must be an array");
    } else {
      if (output.suggestions.length > 3) {
        errors.push("suggestions must have <= 3 items");
      }
      output.suggestions.forEach((item, index) => {
        if (typeof item !== "string" || !item.trim()) {
          errors.push(`suggestions[${index}] must be a non-empty string`);
        } else if (item.trim().length > 120) {
          errors.push(`suggestions[${index}] must be <= 120 chars`);
        }
      });
    }
  }

  if (output.assumptions) {
    if (!Array.isArray(output.assumptions)) {
      errors.push("assumptions must be an array");
    } else {
      if (output.assumptions.length > 8) {
        errors.push("assumptions must have <= 8 items");
      }
      output.assumptions.forEach((item, index) => {
        if (typeof item !== "string" || !item.trim()) {
          errors.push(`assumptions[${index}] must be a non-empty string`);
        } else if (item.trim().length > 140) {
          errors.push(`assumptions[${index}] must be <= 140 chars`);
        }
      });
    }
  }

  const payloads = {
    unknown: output.unknown ?? null,
    core_offer: output.core_offer ?? null,
    strategy: output.strategy ?? null,
    copywriting: output.copywriting ?? null,
  };
  const payloadKeys = Object.entries(payloads).filter(([, value]) => value !== null && value !== undefined).map(([key]) => key);
  if (payloadKeys.length !== 1) {
    errors.push("Exactly one payload must be present (unknown/core_offer/strategy/copywriting)");
  }
  if (payloads.unknown && payloadKeys.length > 1) {
    errors.push("unknown payload cannot be combined with other payloads");
  }

  if (output.unknown) {
    const missing = output.unknown.missing ?? [];
    if (!Array.isArray(missing) || missing.length < 1 || missing.length > 10) {
      errors.push("unknown.missing must be an array with 1-10 items");
    } else {
      missing.forEach((item, index) => {
        if (typeof item !== "string" || !item.trim()) {
          errors.push(`unknown.missing[${index}] must be a non-empty string`);
        } else if (item.trim().length > 80) {
          errors.push(`unknown.missing[${index}] must be <= 80 chars`);
        }
      });
    }
    if (typeof output.unknown.question !== "string" || !output.unknown.question.trim()) {
      errors.push("unknown.question must be a non-empty string");
    } else if (output.unknown.question.trim().length > 180) {
      errors.push("unknown.question must be <= 180 chars");
    }
  }

  if (output.playbook === "core_offer") {
    if (output.strategy || output.copywriting) {
      errors.push("strategy/copywriting payloads must be absent for core_offer");
    }
    const payload = output.core_offer;
    if (!payload) {
      errors.push("core_offer payload is required");
    } else {
      if (!payload.icp_primary?.trim() || payload.icp_primary.length > 120) {
        errors.push("core_offer.icp_primary must be 1-120 chars");
      }
      if (!Array.isArray(payload.icp_secondary) || payload.icp_secondary.length !== 2) {
        errors.push("core_offer.icp_secondary must have exactly 2 items");
      } else {
        payload.icp_secondary.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
            errors.push(`core_offer.icp_secondary[${index}] must be <= 120 chars`);
          }
        });
      }
      if (!payload.pain_promise?.trim() || payload.pain_promise.length > 220) {
        errors.push("core_offer.pain_promise must be 1-220 chars");
      }
      if (!payload.offer_mechanism?.trim() || payload.offer_mechanism.length > 280) {
        errors.push("core_offer.offer_mechanism must be 1-280 chars");
      }
      if (!Array.isArray(payload.tiers) || payload.tiers.length !== 3) {
        errors.push("core_offer.tiers must have exactly 3 items");
      } else {
        payload.tiers.forEach((tier, index) => {
          if (!tier?.name?.trim() || tier.name.length > 40) {
            errors.push(`core_offer.tiers[${index}].name must be 1-40 chars`);
          }
          if (!tier?.price_range?.trim() || tier.price_range.length > 40) {
            errors.push(`core_offer.tiers[${index}].price_range must be 1-40 chars`);
          }
          if (!Array.isArray(tier.deliverables) || tier.deliverables.length < 3 || tier.deliverables.length > 20) {
            errors.push(`core_offer.tiers[${index}].deliverables must be 3-20 items`);
          } else {
            tier.deliverables.forEach((item, itemIndex) => {
              if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
                errors.push(`core_offer.tiers[${index}].deliverables[${itemIndex}] must be <= 120 chars`);
              }
            });
          }
          if (!Number.isInteger(tier.timeline_days) || tier.timeline_days < 1 || tier.timeline_days > 60) {
            errors.push(`core_offer.tiers[${index}].timeline_days must be integer 1-60`);
          }
        });
      }
      if (!Array.isArray(payload.process_timeline) || payload.process_timeline.length < 3 || payload.process_timeline.length > 12) {
        errors.push("core_offer.process_timeline must be 3-12 items");
      } else {
        payload.process_timeline.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 140) {
            errors.push(`core_offer.process_timeline[${index}] must be <= 140 chars`);
          }
        });
      }
      if (!payload.pricing_guidance?.trim() || payload.pricing_guidance.length > 220) {
        errors.push("core_offer.pricing_guidance must be 1-220 chars");
      }
      if (!Array.isArray(payload.risk_reversal) || payload.risk_reversal.length < 1 || payload.risk_reversal.length > 5) {
        errors.push("core_offer.risk_reversal must be 1-5 items");
      } else {
        payload.risk_reversal.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 140) {
            errors.push(`core_offer.risk_reversal[${index}] must be <= 140 chars`);
          }
        });
      }
      if (!Array.isArray(payload.client_inputs) || payload.client_inputs.length < 3 || payload.client_inputs.length > 12) {
        errors.push("core_offer.client_inputs must be 3-12 items");
      } else {
        payload.client_inputs.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
            errors.push(`core_offer.client_inputs[${index}] must be <= 120 chars`);
          }
        });
      }
      if (!Array.isArray(payload.proof_options) || payload.proof_options.length < 2 || payload.proof_options.length > 8) {
        errors.push("core_offer.proof_options must be 2-8 items");
      } else {
        payload.proof_options.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
            errors.push(`core_offer.proof_options[${index}] must be <= 120 chars`);
          }
        });
      }
      if (!payload.proof_collection_7d?.trim() || payload.proof_collection_7d.length > 220) {
        errors.push("core_offer.proof_collection_7d must be 1-220 chars");
      }
      if (!payload.next_action?.trim() || payload.next_action.length > 160) {
        errors.push("core_offer.next_action must be 1-160 chars");
      }
    }
  }

  if (output.playbook === "strategy") {
    if (output.core_offer || output.copywriting) {
      errors.push("core_offer/copywriting payloads must be absent for strategy");
    }
    const payload = output.strategy;
    if (!payload) {
      errors.push("strategy payload is required");
    } else {
      if (!payload.goal_metric?.trim() || payload.goal_metric.length > 120) {
        errors.push("strategy.goal_metric must be 1-120 chars");
      }
      if (!Array.isArray(payload.funnel_map) || payload.funnel_map.length < 3 || payload.funnel_map.length > 10) {
        errors.push("strategy.funnel_map must be 3-10 items");
      } else {
        payload.funnel_map.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 140) {
            errors.push(`strategy.funnel_map[${index}] must be <= 140 chars`);
          }
        });
      }
      if (!Array.isArray(payload.content_pillars) || payload.content_pillars.length !== 3) {
        errors.push("strategy.content_pillars must have exactly 3 items");
      } else {
        payload.content_pillars.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 90) {
            errors.push(`strategy.content_pillars[${index}] must be <= 90 chars`);
          }
        });
      }
      if (!Array.isArray(payload.content_ideas) || payload.content_ideas.length !== 12) {
        errors.push("strategy.content_ideas must have exactly 12 items");
      } else {
        payload.content_ideas.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 140) {
            errors.push(`strategy.content_ideas[${index}] must be <= 140 chars`);
          }
        });
      }
      if (!Array.isArray(payload.experiments) || payload.experiments.length !== 3) {
        errors.push("strategy.experiments must have exactly 3 items");
      } else {
        payload.experiments.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 160) {
            errors.push(`strategy.experiments[${index}] must be <= 160 chars`);
          }
        });
      }
      if (!payload.next_action?.trim() || payload.next_action.length > 160) {
        errors.push("strategy.next_action must be 1-160 chars");
      }
    }
  }

  if (output.playbook === "copywriting") {
    if (output.core_offer || output.strategy) {
      errors.push("core_offer/strategy payloads must be absent for copywriting");
    }
    const payload = output.copywriting;
    if (!payload) {
      errors.push("copywriting payload is required");
    } else {
      if (!Array.isArray(payload.hooks) || payload.hooks.length !== 10) {
        errors.push("copywriting.hooks must have exactly 10 items");
      } else {
        payload.hooks.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
            errors.push(`copywriting.hooks[${index}] must be <= 120 chars`);
          }
        });
      }
      if (!Array.isArray(payload.ad_scripts) || payload.ad_scripts.length !== 3) {
        errors.push("copywriting.ad_scripts must have exactly 3 items");
      } else {
        payload.ad_scripts.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 600) {
            errors.push(`copywriting.ad_scripts[${index}] must be <= 600 chars`);
          }
        });
      }
      if (!Array.isArray(payload.ctas) || payload.ctas.length !== 3) {
        errors.push("copywriting.ctas must have exactly 3 items");
      } else {
        payload.ctas.forEach((item, index) => {
          if (typeof item !== "string" || !item.trim() || item.trim().length > 80) {
            errors.push(`copywriting.ctas[${index}] must be <= 80 chars`);
          }
        });
      }
      if (!payload.next_action?.trim() || payload.next_action.length > 160) {
        errors.push("copywriting.next_action must be 1-160 chars");
      }
    }
  }

  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

function formatList(items: string[], prefix = "- ") {
  return items.map((item) => `${prefix}${item}`).join("\n");
}

function formatNumbered(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function formatStrategicAssistantMessage(output: AdminChatStrategicOutput): string {
  if (output.unknown) {
    const missing = output.unknown.missing?.length ? output.unknown.missing.join(", ") : "required details";
    return `UNKNOWN\n\nNeed: ${missing}\n\nNext Question: ${output.unknown.question}`;
  }

  const nextQuestion = clampClarifyingQuestions(output.clarifying_questions ?? [])[0];
  const assumptions = output.assumptions?.length ? `\nAssumptions:\n${formatList(output.assumptions)}` : "";
  const nextAction = output.playbook === "core_offer"
    ? output.core_offer?.next_action
    : output.playbook === "strategy"
    ? output.strategy?.next_action
    : output.copywriting?.next_action;

  if (output.playbook === "core_offer" && output.core_offer) {
    const tiers = output.core_offer.tiers.map((tier) =>
      `- ${tier.name}: ${tier.price_range} | ${tier.deliverables.join(", ")} | ${tier.timeline_days} days`
    );

    const blocks = [
      `ICP:\n- Primary: ${output.core_offer.icp_primary}\n- Secondary: ${output.core_offer.icp_secondary.join(", ")}`,
      `Pain -> Promise: ${output.core_offer.pain_promise}`,
      `Offer Mechanism: ${output.core_offer.offer_mechanism}`,
      `Deliverables (3 tiers):\n${tiers.join("\n")}`,
      `Process + Timeline:\n${formatList(output.core_offer.process_timeline)}`,
      `Pricing Guidance: ${output.core_offer.pricing_guidance}`,
      `Risk Reversal:\n${formatList(output.core_offer.risk_reversal)}`,
      `Proof Options:\n${formatList(output.core_offer.proof_options)}`,
      `Proof in 7 Days: ${output.core_offer.proof_collection_7d}`,
      `Client Inputs:\n${formatList(output.core_offer.client_inputs)}`,
      assumptions.trim(),
      `Next Action: ${nextAction ?? "Reply with any missing constraints."}`,
    ];
    if (nextQuestion) {
      blocks.push(`Next Question: ${nextQuestion}`);
    }
    return blocks.filter((block) => block && block.trim().length > 0).join("\n\n");
  }

  if (output.playbook === "strategy" && output.strategy) {
    const blocks = [
      `Goal Metric: ${output.strategy.goal_metric}`,
      `Funnel Map:\n${formatNumbered(output.strategy.funnel_map)}`,
      `Content Pillars:\n${formatList(output.strategy.content_pillars)}`,
      `12 Content Ideas:\n${output.strategy.content_ideas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}`,
      `Experiments:\n${formatList(output.strategy.experiments)}`,
      assumptions.trim(),
      `Next Action: ${nextAction ?? "Confirm your top priority."}`,
    ];
    if (nextQuestion) {
      blocks.push(`Next Question: ${nextQuestion}`);
    }
    return blocks.filter((block) => block && block.trim().length > 0).join("\n\n");
  }

  if (output.playbook === "copywriting" && output.copywriting) {
    const blocks = [
      `Hooks:\n${output.copywriting.hooks.map((hook, i) => `${i + 1}. ${hook}`).join("\n")}`,
      `Ad Scripts (15-30s):\n${output.copywriting.ad_scripts.map((script, i) => `${i + 1}. ${script}`).join("\n")}`,
      `CTAs:\n${formatList(output.copywriting.ctas)}`,
      assumptions.trim(),
      `Next Action: ${nextAction ?? "Pick one angle to ship today."}`,
    ];
    if (nextQuestion) {
      blocks.push(`Next Question: ${nextQuestion}`);
    }
    return blocks.filter((block) => block && block.trim().length > 0).join("\n\n");
  }

  return "UNKNOWN\n\nNeed: missing deliverable payload\n\nNext Question: What outcome should I produce?";
}
