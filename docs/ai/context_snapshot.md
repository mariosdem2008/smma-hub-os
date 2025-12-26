# AI Context Snapshot

## Purpose
Every admin chat (guided setup and general) receives a consistent snapshot so the AI knows who it is, who it represents, and what is already known.

## Snapshot Shape
Built in `supabase/functions/_shared/ai-context.ts`:

```
{
  agency: { id, name, website?, niche? },
  admin: { id, full_name?, first_name?, role? },
  onboarding_known_facts: { ...from agency_onboarding_sessions.answers_json },
  agency_brain_existing: { rep_policy_v1?, faq_v1?, ai_context_v1?, setup_profile_v1? }
}
```

## Stable Summary
Stored in `agency_brains.brain_json.ai_context_v1`:

```
{
  agency_name: string | null,
  admin_first_name: string | null,
  services: string[] | null,
  niche: string | null,
  last_updated: ISO string
}
```

## Sources
- `agencies` table (name, website, niche)
- `profiles` table (admin name)
- `agency_onboarding_sessions` (static onboarding answers)
- `agency_brains` (existing knowledge)

Missing data is allowed. The snapshot is still built and passed through.
