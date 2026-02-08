SMMAHUB AI Cofounder - Validation and Follow-ups

Validation rules (hard invalid):
- numeric: must include at least one number.
- percent: >= 2 numbers and sum between 95 and 105.
- tz_lang: must include timezone + at least one language.
- list: must include at least one item.
- text: must have >= 2 characters.

LLM validation:
- Always run ONBOARDING_ANSWER_CHECK for every user answer.
- If LLM returns follow_up, return a clarifying response.

Follow-up limits:
- Max 2 follow-ups per field.
- Track in metadata.followup_counts[field_path].
- After limit: accept input, do not block flow.

P0 strict handling:
- Ask follow-up on unclear P0 answers.
- If still unclear after 2 follow-ups, accept but add to metadata.unresolved_p0[].
- Unresolved P0 fields should be visible in audits.

Clarification rules:
- Use Owner persona to explain why the field matters and how it is used.
- Follow-up is short and specific.
- Do not change the question topic.
