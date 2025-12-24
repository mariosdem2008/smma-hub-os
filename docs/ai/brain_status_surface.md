# Brain Status Surface (Client)

## Purpose
Provide a tenant-safe, derived status surface for client brain usability so the UI never reads `client_brains` directly and `brain_json` remains service-role only.

## RPC Contract
Function: `public.get_client_brain_status(p_client_id uuid)`

Returns (single row or empty):
- `client_id` (uuid)
- `usable` (boolean)
- `missing_fields_count` (integer)
- `missing_fields` (text[])
- `status` (text)
- `locked` (boolean)
- `version` (integer)
- `updated_at` (timestamptz)

Notes:
- `missing_fields` may be empty when `usable = true`.
- If no row exists for the client, the UI treats the client as unusable with `missing_fields_count = 1` and `missing_fields = ['onboarding_not_started']`.

## Access Control
- Requires `auth.uid()` (authenticated caller).
- Requires membership in the same agency as the client via `agency_members`.
- Executable by `authenticated` and `service_role` only (not `anon`).

## Related Service-Only RPC
`public.match_ai_embeddings(...)` is service-role only to prevent client-side vector search access.

## Why It Exists
RLS restricts `client_brains` to service-role access. This RPC exposes only derived, safe fields needed for gating and onboarding resume flows without leaking `brain_json`.
