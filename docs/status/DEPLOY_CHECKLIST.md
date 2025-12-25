# Deploy Checklist — Onboarding V3 + Ingest + Gate + Client Brief v1 + AI Rep

## Supabase DB

1) Apply migrations (if not already applied on remote):
- `supabase db push`

## Supabase Edge Functions

Deploy these functions from repo root:

- `supabase functions deploy ai-brains-client`
- `supabase functions deploy ai-onboarding-guide`
- `supabase functions deploy ai-brain-ingest`
- `supabase functions deploy ai-rep-chat`

## Smoke Tests (5 steps)

1) Create/select a client and open `Client Detail` (should block before onboarding if brain unusable).
2) Run AI Onboarding V3 and click **Lock & Finish**.
3) Refresh `Client Detail`:
   - Gate should disappear (`usable=true`, `missing_fields_count=0` via `get_client_brain_status`).
4) Verify brain has brief:
   - Latest `client_brains.brain_json.client_brief_v1` exists and has `pillars` (>=3) and `taboo_topics` (non-empty).
5) Open **AI Rep** tab and send a message:
   - If brief exists, response should not start with `UNKNOWN`.
   - If brief missing critical info, response should be `UNKNOWN` + exactly 1 clarification.

