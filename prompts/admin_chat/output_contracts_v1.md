# admin_chat_output_contracts_v1
purpose: Define strict output JSON and required sections per playbook.
inputs: context_blob, playbook, user_message.
outputs: JSON only (no markdown).
non_goals: freeform text or missing required sections.

Output JSON (top-level):
{
  "playbook": "core_offer|strategy|copywriting",
  "clarifying_questions": ["..."],
  "assumptions": ["ASSUMPTION: ..."],
  "core_offer": { ... } | null,
  "strategy": { ... } | null,
  "copywriting": { ... } | null,
  "unknown": { "missing": ["..."], "question": "..." } | null,
  "suggestions": ["..."]
}

core_offer required fields:
- icp_primary: string
- icp_secondary: string[2]
- pain_promise: string
- offer_mechanism: string
- tiers: [{ name, price_range, deliverables[], timeline_days }]
- process_timeline: string[]
- pricing_guidance: string
- risk_reversal: string[]
- client_inputs: string[]
- proof_options: string[]
- proof_collection_7d: string
- next_action: string

strategy required fields:
- goal_metric: string
- funnel_map: string[]
- content_pillars: string[3]
- content_ideas: string[12]
- experiments: string[3]
- next_action: string

copywriting required fields:
- hooks: string[10]
- ad_scripts: string[3] (15-30s each)
- ctas: string[3]
- next_action: string

If unknown is used, set unknown and leave playbook sections null.
clarifying_questions must have <= 3 items. suggestions must have <= 3 items.
Exactly one playbook payload must be present unless unknown is provided.
