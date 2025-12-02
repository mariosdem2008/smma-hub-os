-- Drop existing policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Agency members can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Agency members can update their own messages" ON public.messages;

-- Allow agency members to delete their own messages
CREATE POLICY "Agency members can delete their own messages" 
ON public.messages 
FOR DELETE 
USING (
  sender_type = 'agency_member' 
  AND sender_agency_member_id IN (
    SELECT id FROM public.agency_members WHERE user_id = auth.uid()
  )
);

-- Allow agency members to update their own messages
CREATE POLICY "Agency members can update their own messages" 
ON public.messages 
FOR UPDATE 
USING (
  sender_type = 'agency_member' 
  AND sender_agency_member_id IN (
    SELECT id FROM public.agency_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  sender_type = 'agency_member' 
  AND sender_agency_member_id IN (
    SELECT id FROM public.agency_members WHERE user_id = auth.uid()
  )
);