-- Fix client_uploads RLS policies to work for client portal users not using Supabase Auth
DROP POLICY IF EXISTS "Client portal users can upload files" ON public.client_uploads;
DROP POLICY IF EXISTS "Client users can view their own uploads" ON public.client_uploads;

CREATE POLICY "Client portal users can upload files"
ON public.client_uploads
FOR INSERT
WITH CHECK (
  uploaded_by IN (
    SELECT cu.id
    FROM public.client_users cu
    WHERE cu.client_id = client_uploads.client_id
  )
);

CREATE POLICY "Client users can view their own uploads"
ON public.client_uploads
FOR SELECT
USING (
  uploaded_by IN (
    SELECT cu.id
    FROM public.client_users cu
    WHERE cu.client_id = client_uploads.client_id
  )
);

-- Helper function to cascade-delete a client and all related data
CREATE OR REPLACE FUNCTION public.delete_client_cascade(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Delete approval tasks linked to this client's asset versions
  DELETE FROM public.approval_tasks at
  USING public.asset_versions av, public.assets a
  WHERE at.asset_version_id = av.id
    AND av.asset_id = a.id
    AND a.client_id = p_client_id;

  -- Delete asset comments
  DELETE FROM public.asset_comments ac
  USING public.assets a
  WHERE ac.asset_id = a.id
    AND a.client_id = p_client_id;

  -- Delete post metrics for this client's assets
  DELETE FROM public.post_metrics pm
  USING public.assets a
  WHERE pm.asset_id = a.id
    AND a.client_id = p_client_id;

  -- Delete asset versions
  DELETE FROM public.asset_versions av
  USING public.assets a
  WHERE av.asset_id = a.id
    AND a.client_id = p_client_id;

  -- Delete assets
  DELETE FROM public.assets a
  WHERE a.client_id = p_client_id;

  -- Delete client uploads
  DELETE FROM public.client_uploads cu
  WHERE cu.client_id = p_client_id;

  -- Delete client assets (raw uploads / brand assets)
  DELETE FROM public.client_assets ca
  WHERE ca.client_id = p_client_id;

  -- Delete ideas
  DELETE FROM public.ideas i
  WHERE i.client_id = p_client_id;

  -- Delete captions
  DELETE FROM public.captions c
  WHERE c.client_id = p_client_id;

  -- Delete messages
  DELETE FROM public.messages m
  WHERE m.client_id = p_client_id;

  -- Delete content activities
  DELETE FROM public.content_activities ca
  WHERE ca.client_id = p_client_id;

  -- Delete client branding
  DELETE FROM public.client_branding cb
  WHERE cb.client_id = p_client_id;

  -- Delete client hashtags
  DELETE FROM public.client_hashtags ch
  WHERE ch.client_id = p_client_id;

  -- Delete social connections and profiles
  DELETE FROM public.social_connections sc
  WHERE sc.client_id = p_client_id;

  DELETE FROM public.social_profiles sp
  WHERE sp.client_id = p_client_id;

  -- Delete client portal users and invites
  DELETE FROM public.client_users cu
  WHERE cu.client_id = p_client_id;

  DELETE FROM public.client_invites ci
  WHERE ci.client_id = p_client_id;

  -- Finally delete the client record itself
  DELETE FROM public.clients c
  WHERE c.id = p_client_id;
END;
$$;