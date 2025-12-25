# Agency Admin “Revelation Chat”

## Route
- Agency dashboard (admin-only): `/ai/admin` → `src/pages/ai/AgencyAiAdmin.tsx`

## Edge Function
- Name: `ai-agency-admin-chat`
- Entry: `supabase/functions/ai-agency-admin-chat/index.ts`
- Shared core (unit-tested): `supabase/functions/_shared/agency-admin-chat.ts`

### Input
```json
{ "thread_id": "optional", "message": "required" }
```

### Output
```json
{ "thread_id": "uuid", "assistant_message": "string", "suggested_choices": ["string"] }
```

### Auth / Access Control
- Server-side admin enforcement (403 when not admin): checks `agency_members.role = 'admin'` for the thread’s `agency_id` (or the caller’s admin agency when creating a new thread).

## Tables
- `agency_ai_chat_threads` (id, agency_id, created_by, title, created_at)
- `agency_ai_chat_messages` (id, thread_id, role, content, meta_json, created_at)

Migrations:
- `supabase/migrations/20251225190000_agency_admin_chat.sql`
- `supabase/migrations/20251225190100_grant_agency_admin_chat.sql`

## Deploy
- `supabase functions deploy ai-agency-admin-chat`

