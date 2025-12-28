-- Migration: Brain Documents System + Calibration State
-- Purpose: Implement versioned brain documents for Agency Brain system
--          and add calibration_state for idempotent setup flow

-- ============================================================================
-- PHASE 1: Brain Documents Tables
-- ============================================================================

-- Brain document module types (matches BrainModule enum in TypeScript)
CREATE TYPE public.brain_module AS ENUM (
  'bootstrap',
  'rep_policy',
  'sop_strategy',
  'sop_scripting',
  'tone_voice',
  'faq_objections',
  'ai_permissions',
  'offer_stack',
  'quality_bar'
);

-- Brain document status types
CREATE TYPE public.brain_document_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'archived'
);

-- Brain document source types
CREATE TYPE public.brain_document_source AS ENUM (
  'onboarding',
  'chat',
  'manual',
  'ai_proposed'
);

-- brain_documents: individual brain artifacts with versioning
CREATE TABLE public.brain_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  module public.brain_module NOT NULL,
  title TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}',
  status public.brain_document_status NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  parent_version_id UUID REFERENCES public.brain_documents(id),
  source public.brain_document_source NOT NULL DEFAULT 'manual',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- brain_document_versions: immutable version history for audit trail
CREATE TABLE public.brain_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.brain_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_json JSONB NOT NULL,
  diff_json JSONB,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for brain_documents
CREATE INDEX idx_brain_docs_agency_module ON public.brain_documents(agency_id, module);
CREATE INDEX idx_brain_docs_agency_status ON public.brain_documents(agency_id, status);
CREATE INDEX idx_brain_docs_updated_at ON public.brain_documents(updated_at DESC);

-- Unique constraint: only one approved document per module per agency
CREATE UNIQUE INDEX idx_brain_docs_unique_approved ON public.brain_documents(agency_id, module)
  WHERE status = 'approved';

-- Indexes for brain_document_versions
CREATE INDEX idx_brain_doc_versions_doc ON public.brain_document_versions(document_id, version);
CREATE INDEX idx_brain_doc_versions_created ON public.brain_document_versions(created_at DESC);

-- Trigger to update updated_at on brain_documents
CREATE OR REPLACE FUNCTION public.update_brain_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_brain_documents_updated_at
  BEFORE UPDATE ON public.brain_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_brain_document_updated_at();

-- ============================================================================
-- PHASE 1: RLS Policies for Brain Documents
-- ============================================================================

ALTER TABLE public.brain_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_document_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read brain documents for agencies they are members of
CREATE POLICY brain_docs_select_policy ON public.brain_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = brain_documents.agency_id
        AND am.user_id = auth.uid()
    )
  );

-- Policy: Users can insert brain documents for agencies they are admin/owner of
CREATE POLICY brain_docs_insert_policy ON public.brain_documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = brain_documents.agency_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Policy: Users can update brain documents for agencies they are admin/owner of
CREATE POLICY brain_docs_update_policy ON public.brain_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = brain_documents.agency_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Policy: Only owners can delete brain documents
CREATE POLICY brain_docs_delete_policy ON public.brain_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = brain_documents.agency_id
        AND am.user_id = auth.uid()
        AND am.role = 'owner'
    )
  );

-- Policy: Users can read version history for documents they can access
CREATE POLICY brain_doc_versions_select_policy ON public.brain_document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brain_documents bd
      JOIN public.agency_members am ON am.agency_id = bd.agency_id
      WHERE bd.id = brain_document_versions.document_id
        AND am.user_id = auth.uid()
    )
  );

-- Policy: Users can insert version history for documents they can edit
CREATE POLICY brain_doc_versions_insert_policy ON public.brain_document_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brain_documents bd
      JOIN public.agency_members am ON am.agency_id = bd.agency_id
      WHERE bd.id = brain_document_versions.document_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- PHASE 1: RPCs for Brain Documents
-- ============================================================================

-- Get all approved brain documents for an agency
CREATE OR REPLACE FUNCTION public.get_approved_brain_documents(p_agency_id UUID)
RETURNS SETOF public.brain_documents
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT *
  FROM public.brain_documents
  WHERE agency_id = p_agency_id
    AND status = 'approved'
  ORDER BY module;
$$;

-- Get brain document by agency and module (includes drafts)
CREATE OR REPLACE FUNCTION public.get_brain_document(
  p_agency_id UUID,
  p_module public.brain_module,
  p_status public.brain_document_status DEFAULT NULL
)
RETURNS SETOF public.brain_documents
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT *
  FROM public.brain_documents
  WHERE agency_id = p_agency_id
    AND module = p_module
    AND (p_status IS NULL OR status = p_status)
  ORDER BY
    CASE status
      WHEN 'approved' THEN 1
      WHEN 'pending_approval' THEN 2
      WHEN 'draft' THEN 3
      ELSE 4
    END,
    updated_at DESC
  LIMIT 1;
$$;

-- Create a new brain document draft
CREATE OR REPLACE FUNCTION public.create_brain_document_draft(
  p_agency_id UUID,
  p_module public.brain_module,
  p_title TEXT,
  p_content_json JSONB,
  p_source public.brain_document_source DEFAULT 'manual'
)
RETURNS public.brain_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result public.brain_documents;
BEGIN
  v_user_id := auth.uid();

  -- Verify user has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_members am
    WHERE am.agency_id = p_agency_id
      AND am.user_id = v_user_id
      AND am.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: user is not an admin of this agency';
  END IF;

  -- Insert new draft
  INSERT INTO public.brain_documents (
    agency_id, module, title, content_json, status, source, created_by
  ) VALUES (
    p_agency_id, p_module, p_title, p_content_json, 'draft', p_source, v_user_id
  )
  RETURNING * INTO v_result;

  -- Create initial version record
  INSERT INTO public.brain_document_versions (
    document_id, version, content_json, change_summary, created_by
  ) VALUES (
    v_result.id, 1, p_content_json, 'Initial draft created', v_user_id
  );

  RETURN v_result;
END;
$$;

-- Update a brain document (creates new version)
CREATE OR REPLACE FUNCTION public.update_brain_document(
  p_document_id UUID,
  p_content_json JSONB,
  p_change_summary TEXT DEFAULT NULL
)
RETURNS public.brain_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_current_doc public.brain_documents;
  v_new_version INTEGER;
  v_diff JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Get current document
  SELECT * INTO v_current_doc
  FROM public.brain_documents
  WHERE id = p_document_id;

  IF v_current_doc IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Verify user has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_members am
    WHERE am.agency_id = v_current_doc.agency_id
      AND am.user_id = v_user_id
      AND am.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Prevent editing approved documents directly
  IF v_current_doc.status = 'approved' THEN
    RAISE EXCEPTION 'Cannot edit approved document directly. Create a new draft instead.';
  END IF;

  -- Calculate new version
  v_new_version := v_current_doc.version + 1;

  -- Update document
  UPDATE public.brain_documents
  SET
    content_json = p_content_json,
    version = v_new_version,
    updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_current_doc;

  -- Create version record
  INSERT INTO public.brain_document_versions (
    document_id, version, content_json, change_summary, created_by
  ) VALUES (
    p_document_id, v_new_version, p_content_json,
    COALESCE(p_change_summary, 'Content updated'),
    v_user_id
  );

  RETURN v_current_doc;
END;
$$;

-- Approve a brain document
CREATE OR REPLACE FUNCTION public.approve_brain_document(p_document_id UUID)
RETURNS public.brain_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_doc public.brain_documents;
BEGIN
  v_user_id := auth.uid();

  -- Get document
  SELECT * INTO v_doc
  FROM public.brain_documents
  WHERE id = p_document_id;

  IF v_doc IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Verify user has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_members am
    WHERE am.agency_id = v_doc.agency_id
      AND am.user_id = v_user_id
      AND am.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Archive existing approved document for this module
  UPDATE public.brain_documents
  SET status = 'archived'
  WHERE agency_id = v_doc.agency_id
    AND module = v_doc.module
    AND status = 'approved'
    AND id != p_document_id;

  -- Approve the document
  UPDATE public.brain_documents
  SET
    status = 'approved',
    approved_at = now(),
    approved_by = v_user_id,
    updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_doc;

  RETURN v_doc;
END;
$$;

-- Get version history for a document
CREATE OR REPLACE FUNCTION public.get_brain_document_history(p_document_id UUID)
RETURNS SETOF public.brain_document_versions
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT v.*
  FROM public.brain_document_versions v
  JOIN public.brain_documents d ON d.id = v.document_id
  JOIN public.agency_members am ON am.agency_id = d.agency_id
  WHERE v.document_id = p_document_id
    AND am.user_id = auth.uid()
  ORDER BY v.version DESC;
$$;

-- ============================================================================
-- PHASE 3: Calibration State Column
-- ============================================================================

-- Add calibration_state column to agency_brains for idempotent setup tracking
ALTER TABLE public.agency_brains
ADD COLUMN IF NOT EXISTS calibration_state JSONB DEFAULT '{}';

COMMENT ON COLUMN public.agency_brains.calibration_state IS
  'Server-side calibration tracking for idempotent setup flow. Schema: { session_id, current_step, answered_keys[], last_question_id, last_question_hash, completed_at }';

-- Create index for faster calibration state lookups
CREATE INDEX IF NOT EXISTS idx_agency_brains_calibration_state
  ON public.agency_brains USING gin (calibration_state);

-- ============================================================================
-- PHASE 4 (Preview): Task Module Requirements Table
-- ============================================================================

-- task_module_requirements: which brain modules each task type needs
CREATE TABLE public.task_module_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  module public.brain_module NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  field_paths TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_type, module)
);

-- Seed data for task-to-module mapping
INSERT INTO public.task_module_requirements (task_type, module, required, field_paths) VALUES
  ('STRATEGY_PLAN', 'bootstrap', true, ARRAY['identity.offers', 'icp.industries']),
  ('STRATEGY_PLAN', 'tone_voice', true, ARRAY['adjectives', 'writing_rules']),
  ('STRATEGY_PLAN', 'sop_strategy', true, ARRAY['pillars']),
  ('CONTENT_IDEAS', 'bootstrap', true, ARRAY['identity.offers']),
  ('CONTENT_IDEAS', 'tone_voice', false, ARRAY[]::TEXT[]),
  ('SCRIPT_WRITING', 'sop_scripting', true, ARRAY['hooks', 'cta_templates']),
  ('SCRIPT_WRITING', 'tone_voice', true, ARRAY['adjectives', 'banned_words']),
  ('CLIENT_PORTAL_QA', 'faq_objections', true, ARRAY['faqs']),
  ('CLIENT_PORTAL_QA', 'rep_policy', true, ARRAY['boundaries']),
  ('AGENCY_ADMIN_GENERAL_CHAT', 'bootstrap', false, ARRAY[]::TEXT[]),
  ('AGENCY_ADMIN_GENERAL_CHAT', 'rep_policy', false, ARRAY[]::TEXT[])
ON CONFLICT (task_type, module) DO NOTHING;

-- RLS for task_module_requirements (read-only for all authenticated users)
ALTER TABLE public.task_module_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_module_requirements_select_policy ON public.task_module_requirements
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT USAGE ON TYPE public.brain_module TO authenticated;
GRANT USAGE ON TYPE public.brain_document_status TO authenticated;
GRANT USAGE ON TYPE public.brain_document_source TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_documents TO authenticated;
GRANT SELECT, INSERT ON public.brain_document_versions TO authenticated;
GRANT SELECT ON public.task_module_requirements TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_approved_brain_documents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_brain_document(UUID, public.brain_module, public.brain_document_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_brain_document_draft(UUID, public.brain_module, TEXT, JSONB, public.brain_document_source) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_brain_document(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_brain_document(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_brain_document_history(UUID) TO authenticated;
