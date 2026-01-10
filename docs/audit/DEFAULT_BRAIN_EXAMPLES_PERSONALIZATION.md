# Default Brain Examples — Personalization (UI-Only)

Goal: make the “Open Example” reference docs personalized (agency name/website/niche) without persisting anything to the database.

## Placeholders

All example markdown files support these placeholders:

- `{{agency_name}}`
- `{{agency_website}}`
- `{{agency_niche}}`

## Where example markdown lives

- `src/lib/brain/examples.ts` imports markdown files from `src/lib/brain/examples/*.md` using Vite `?raw`.
- The markdown sources are the files in `src/lib/brain/examples/`.

## What changed

### 1) Markdown sources updated (safe + placeholder-first)

Updated all example markdown sources in `src/lib/brain/examples/` to:

- Replace niche-specific assumptions (e.g. “B2B SaaS”) with neutral placeholders or bracketed prompts.
- Add a consistent “Example Context (Safe Defaults)” section that includes the placeholders.

Files touched:

- `src/lib/brain/examples/bootstrap.md`
- `src/lib/brain/examples/rep_policy.md`
- `src/lib/brain/examples/scripting_sop.md`
- `src/lib/brain/examples/strategy_sop.md`
- `src/lib/brain/examples/tone_voice.md`
- `src/lib/brain/examples/faq_objections.md`
- `src/lib/brain/examples/ai_permissions.md`
- `src/lib/brain/examples/offer_stack.md`
- `src/lib/brain/examples/quality_bar.md`

### 2) Example rendering now applies placeholder replacement at display-time

- `src/components/brain/layer-detail/ExampleDocCard.tsx` now:
  - Fetches agency fields via `useAgencyData()`.
  - Replaces placeholders in both `exampleContent` and `previewContent` before rendering.
  - Copies the rendered (personalized) example to clipboard (still no DB writes).

Renderer used:

- `renderTemplate` from `src/brain/defaultPackV1.ts` (recursive string replacement).

### 3) Tests added

Two UI tests verify that personalized examples render the agency name:

- `src/components/brain/layer-detail/__tests__/ExampleDocCard.test.tsx`

Also, `src/components/brain/__tests__/BrainLayerDetail.test.tsx` now mocks `useAgencyData` because `ExampleDocCard` depends on it.

## Non-goals / guarantees

- No persistence: these example docs remain UI-only reference content.
- No LLM calls: personalization is simple placeholder replacement.
- UX unchanged: the “Open Example” flow is still accessible from the empty state.

