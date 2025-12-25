# Deploy Note — Portal AI Rep Access

## What changed
- `supabase/functions/ai-rep-chat/index.ts` now allows **client portal** users to call `ai-rep-chat` when `clients.portal_user_id === auth.uid()`, and still enforces agency-member access for agency users.

## Deploy
- `supabase functions deploy ai-rep-chat`

