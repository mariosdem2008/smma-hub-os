# Default Brain Pack v1 — UI CTA (Agency Brain Empty State)

## What was added

When viewing an Agency Brain layer with no documents, the UI shows a primary CTA to seed + approve + ingest the “Default Brain Pack v1” by calling the edge function `ai-seed-default-brain-pack`.

## CTA visibility rule

The button only renders in the layer empty-state (`moduleDocuments.length === 0`) and only when the agency has **0 total** `brain_documents` in the database (not just 0 for the current module).

- Empty-state branch: `src/pages/agency/BrainLayerDetail.tsx:394`
- Total docs count query hook used to gate CTA: `src/pages/agency/BrainLayerDetail.tsx:101`
- CTA condition (count must be 0): `src/pages/agency/BrainLayerDetail.tsx:411`

The total-docs count is fetched with a head+count query:
- `src/hooks/useBrainDocumentsCount.ts:8`
- Supabase table queried: `brain_documents` (`src/hooks/useBrainDocumentsCount.ts:13`)

## What happens on click

The click handler calls the edge function and then relies on React Query invalidation to refresh brain documents:

- Handler: `src/pages/agency/BrainLayerDetail.tsx:182`
- Edge function invocation: `src/hooks/useSeedDefaultBrainPack.ts:17`
- Query invalidation for refresh: `src/hooks/useSeedDefaultBrainPack.ts:25`

The invoked edge function is:
- `supabase/functions/ai-seed-default-brain-pack/index.ts:28`

## Error UI requirement (seeded but not ingested)

If the edge function returns `seeded:true` but `ingested:false`, the UI renders a warning alert and (when present) shows up to 5 structured errors from the response:

- Empty-state alert: `src/pages/agency/BrainLayerDetail.tsx:434`
- Non-empty alert (so the user still sees it after docs appear): `src/pages/agency/BrainLayerDetail.tsx:504`

## Tests

Two UI tests cover the CTA:

- Appears when empty and agency doc count is 0: `src/components/brain/__tests__/BrainLayerDetail.test.tsx:181`
- Disappears after seeding when agency doc count becomes > 0: `src/components/brain/__tests__/BrainLayerDetail.test.tsx:195`

