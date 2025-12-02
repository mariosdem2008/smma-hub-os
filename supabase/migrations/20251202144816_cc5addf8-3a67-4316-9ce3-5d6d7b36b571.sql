-- Backfill existing client_chat conversations with missing client user participants
-- This adds all client_users for a client to their client_chat conversation if not already present

INSERT INTO public.conversation_participants (conversation_id, agency_id, agency_member_id, client_user_id, role)
SELECT 
  c.id AS conversation_id,
  c.agency_id,
  NULL AS agency_member_id,
  cu.id AS client_user_id,
  'client_user' AS role
FROM public.conversations c
JOIN public.client_users cu ON cu.client_id = c.client_id
WHERE c.type = 'client_chat'
  AND c.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.conversation_participants cp 
    WHERE cp.conversation_id = c.id 
      AND cp.client_user_id = cu.id
  )
ON CONFLICT DO NOTHING;