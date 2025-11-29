-- Fix all SQL functions with proper search_path and security settings
-- Part 1: Fix function search_path issues

CREATE OR REPLACE FUNCTION public.update_scripts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_projects_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_content_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_actor_id uuid;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
    v_actor_id := COALESCE(auth.uid(), NEW.reviewed_by, '00000000-0000-0000-0000-000000000000'::uuid);
    
    INSERT INTO public.content_activities (
      content_type,
      content_id,
      client_id,
      action,
      actor_id,
      comment
    ) VALUES (
      TG_ARGV[0],
      NEW.id,
      NEW.client_id,
      CASE 
        WHEN TG_OP = 'INSERT' OR NEW.status = 'draft' THEN 'created'
        WHEN NEW.status = 'in_review' THEN 'submitted'
        WHEN NEW.status = 'approved' THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'updated'
      END,
      v_actor_id,
      NEW.review_comment
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_monthly_ai_usage(p_agency_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM public.ai_generation_usage
  WHERE agency_id = p_agency_id
    AND month_year = TO_CHAR(NOW(), 'YYYY-MM');
$function$;

CREATE OR REPLACE FUNCTION public.accept_agency_invite(_invite_token text, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite
  FROM public.agency_invites
  WHERE token = _invite_token
    AND accepted = FALSE
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid or expired invite'
    );
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.agency_members
    WHERE agency_id = v_invite.agency_id
      AND user_id = _user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User is already a member of this agency'
    );
  END IF;
  
  INSERT INTO public.agency_members (agency_id, user_id, role, accepted_at)
  VALUES (v_invite.agency_id, _user_id, v_invite.role, NOW());
  
  UPDATE public.agency_invites
  SET accepted = TRUE
  WHERE id = v_invite.id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'agency_id', v_invite.agency_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_portal_invite_token()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  RETURN encode(extensions.gen_random_bytes(32), 'hex');
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_stage_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  valid_transition BOOLEAN := FALSE;
BEGIN
  IF OLD.pipeline_stage = NEW.pipeline_stage THEN
    RETURN NEW;
  END IF;

  valid_transition := (
    (OLD.pipeline_stage = 'idea' AND NEW.pipeline_stage = 'in_production') OR
    (OLD.pipeline_stage = 'in_production' AND NEW.pipeline_stage = 'review') OR
    (OLD.pipeline_stage = 'review' AND NEW.pipeline_stage = 'approved') OR
    (OLD.pipeline_stage = 'review' AND NEW.pipeline_stage = 'in_production') OR
    (OLD.pipeline_stage = 'approved' AND NEW.pipeline_stage = 'scheduled') OR
    (OLD.pipeline_stage = 'scheduled' AND NEW.pipeline_stage = 'published') OR
    (is_agency_admin((SELECT c.agency_id FROM clients c JOIN assets a ON a.client_id = c.id WHERE a.id = NEW.id), auth.uid()))
  );

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid pipeline stage transition from % to %', OLD.pipeline_stage, NEW.pipeline_stage;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_pipeline_stage(_asset_id uuid, _new_stage pipeline_stage)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_asset RECORD;
  v_agency_id UUID;
  v_result JSONB;
BEGIN
  SELECT a.*, c.agency_id INTO v_asset
  FROM assets a
  JOIN clients c ON a.client_id = c.id
  WHERE a.id = _asset_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Asset not found'
    );
  END IF;

  v_agency_id := v_asset.agency_id;

  IF NOT EXISTS (
    SELECT 1 FROM agency_members
    WHERE agency_id = v_agency_id
      AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unauthorized'
    );
  END IF;

  UPDATE assets
  SET pipeline_stage = _new_stage,
      updated_at = now()
  WHERE id = _asset_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'asset_id', _asset_id,
    'old_stage', v_asset.pipeline_stage,
    'new_stage', _new_stage
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_agency_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.agency_members
    WHERE user_id = _user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_users
    WHERE id = _user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT client_id
  FROM public.client_users
  WHERE id = _user_id
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_agency_invite_by_token(_token text)
RETURNS TABLE(id uuid, agency_id uuid, email text, role text, expires_at timestamp with time zone, accepted boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT 
    id,
    agency_id,
    email,
    role,
    expires_at,
    accepted
  FROM public.agency_invites
  WHERE token = _token
    AND accepted = FALSE
    AND expires_at > NOW()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.delete_client_cascade(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.approval_tasks at
  USING public.asset_versions av, public.assets a
  WHERE at.asset_version_id = av.id
    AND av.asset_id = a.id
    AND a.client_id = p_client_id;

  DELETE FROM public.asset_comments ac
  USING public.assets a
  WHERE ac.asset_id = a.id
    AND a.client_id = p_client_id;

  DELETE FROM public.asset_versions av
  USING public.assets a
  WHERE av.asset_id = a.id
    AND a.client_id = p_client_id;

  DELETE FROM public.assets a
  WHERE a.client_id = p_client_id;

  DELETE FROM public.client_uploads cu
  WHERE cu.client_id = p_client_id;

  DELETE FROM public.client_assets ca
  WHERE ca.client_id = p_client_id;

  DELETE FROM public.ideas i
  WHERE i.client_id = p_client_id;

  DELETE FROM public.captions c
  WHERE c.client_id = p_client_id;

  DELETE FROM public.messages m
  WHERE m.client_id = p_client_id;

  DELETE FROM public.content_activities ca
  WHERE ca.client_id = p_client_id;

  DELETE FROM public.client_branding cb
  WHERE cb.client_id = p_client_id;

  DELETE FROM public.client_hashtags ch
  WHERE ch.client_id = p_client_id;

  DELETE FROM public.social_connections sc
  WHERE sc.client_id = p_client_id;

  DELETE FROM public.social_profiles sp
  WHERE sp.client_id = p_client_id;

  DELETE FROM public.client_users cu
  WHERE cu.client_id = p_client_id;

  DELETE FROM public.client_invites ci
  WHERE ci.client_id = p_client_id;

  DELETE FROM public.clients c
  WHERE c.id = p_client_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_social_connection_tokens(_connection_id uuid)
RETURNS TABLE(access_token text, refresh_token text, token_expires_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM social_connections sc
    JOIN clients c ON sc.client_id = c.id
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE sc.id = _connection_id
      AND am.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to connection tokens';
  END IF;

  RETURN QUERY
  SELECT 
    sc.access_token,
    sc.refresh_token,
    sc.token_expires_at
  FROM social_connections sc
  WHERE sc.id = _connection_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_agency_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_agency_owner(_agency_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.agencies
    WHERE id = _agency_id
      AND user_id = _user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.validate_client_idea_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status NOT IN ('idea', 'approved', 'rejected', 'used') THEN
    RAISE EXCEPTION 'Invalid status. Must be one of: idea, approved, rejected, used';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_agency_admin(_agency_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.agency_members
    WHERE agency_id = _agency_id
      AND user_id = _user_id
      AND role IN ('owner', 'admin')
  );
$function$;

CREATE OR REPLACE FUNCTION public.check_multi_admin_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  admin_count INTEGER;
  agency_owner_id UUID;
  owner_plan_type TEXT;
BEGIN
  IF NEW.role = 'admin' THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.agency_members
    WHERE agency_id = NEW.agency_id
      AND role IN ('owner', 'admin')
      AND user_id != NEW.user_id;
    
    IF admin_count > 0 THEN
      SELECT a.user_id INTO agency_owner_id
      FROM public.agencies a
      WHERE a.id = NEW.agency_id;
      
      SELECT s.plan_type INTO owner_plan_type
      FROM public.subscriptions s
      WHERE s.user_id = agency_owner_id;
      
      IF owner_plan_type != 'agency_plus' THEN
        RAISE EXCEPTION 'Multi-admin feature requires Agency Plus plan';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_portal_slug()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  new_slug TEXT;
  slug_exists BOOLEAN;
BEGIN
  LOOP
    new_slug := lower(substring(md5(random()::text) from 1 for 8));
    
    SELECT EXISTS(SELECT 1 FROM clients WHERE portal_slug = new_slug) INTO slug_exists;
    
    EXIT WHEN NOT slug_exists;
  END LOOP;
  
  RETURN new_slug;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_portal_token()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  RETURN encode(extensions.gen_random_bytes(32), 'hex');
END;
$function$;

-- Part 2: Move extensions from public to extensions schema

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop and recreate uuid-ossp extension in extensions schema
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Drop and recreate pgcrypto extension in extensions schema
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Update function references to use extensions schema
-- The generate_portal_invite_token and generate_portal_token functions already updated above

-- Grant usage on extensions schema to authenticated and service_role
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT USAGE ON SCHEMA extensions TO anon;