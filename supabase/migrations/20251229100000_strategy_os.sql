-- Strategy OS Migration
-- Creates tables for the Strategy OS feature: strategy_modules, strategy_history, strategy_tasks

-- Strategy module types (6 modules only)
DO $$ BEGIN
  CREATE TYPE public.strategy_module AS ENUM (
    'positioning',
    'pillars',
    'campaign_plan',
    'weekly_plan',
    'channel_adaptations',
    'rules_constraints'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Strategy status
DO $$ BEGIN
  CREATE TYPE public.strategy_status AS ENUM (
    'empty',
    'ai_draft',
    'draft',
    'review',
    'approved',
    'locked'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main strategy modules table
CREATE TABLE IF NOT EXISTS public.strategy_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  module public.strategy_module NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}',
  status public.strategy_status NOT NULL DEFAULT 'empty',
  completion_percent INTEGER DEFAULT 0,
  blocker_count INTEGER DEFAULT 0,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1,
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence INTEGER,
  owner_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, module)
);

-- History events for audit trail
CREATE TABLE IF NOT EXISTS public.strategy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.strategy_modules(id) ON DELETE SET NULL,
  module public.strategy_module,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'locked', 'unlocked', 'seeded', 'approved'
  event_data JSONB DEFAULT '{}',
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Strategy tasks per module
CREATE TABLE IF NOT EXISTS public.strategy_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.strategy_modules(id) ON DELETE SET NULL,
  module public.strategy_module,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'pushed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  pipeline_task_id UUID, -- linked pipeline task after push
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_strategy_modules_client ON public.strategy_modules(client_id);
CREATE INDEX IF NOT EXISTS idx_strategy_modules_agency ON public.strategy_modules(agency_id);
CREATE INDEX IF NOT EXISTS idx_strategy_modules_status ON public.strategy_modules(status);
CREATE INDEX IF NOT EXISTS idx_strategy_history_client ON public.strategy_history(client_id);
CREATE INDEX IF NOT EXISTS idx_strategy_history_module ON public.strategy_history(module_id);
CREATE INDEX IF NOT EXISTS idx_strategy_history_created ON public.strategy_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_client ON public.strategy_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_module ON public.strategy_tasks(module_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_status ON public.strategy_tasks(status);

-- Enable RLS
ALTER TABLE public.strategy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for strategy_modules
CREATE POLICY strategy_modules_select ON public.strategy_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_modules.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_modules_insert ON public.strategy_modules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_modules.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_modules_update ON public.strategy_modules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_modules.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_modules_delete ON public.strategy_modules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_modules.agency_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for strategy_history
CREATE POLICY strategy_history_select ON public.strategy_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_history.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_history_insert ON public.strategy_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_history.client_id
        AND am.user_id = auth.uid()
    )
  );

-- RLS Policies for strategy_tasks
CREATE POLICY strategy_tasks_select ON public.strategy_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_tasks.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_tasks_insert ON public.strategy_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_tasks.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_tasks_update ON public.strategy_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_tasks.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_tasks_delete ON public.strategy_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_tasks.client_id
        AND am.user_id = auth.uid()
    )
  );

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_strategy_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS strategy_modules_updated_at ON public.strategy_modules;
CREATE TRIGGER strategy_modules_updated_at
  BEFORE UPDATE ON public.strategy_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategy_modules_updated_at();

DROP TRIGGER IF EXISTS strategy_tasks_updated_at ON public.strategy_tasks;
CREATE TRIGGER strategy_tasks_updated_at
  BEFORE UPDATE ON public.strategy_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategy_modules_updated_at();

-- Helper function to get strategy modules for a client
CREATE OR REPLACE FUNCTION public.get_strategy_modules(p_client_id UUID)
RETURNS SETOF public.strategy_modules
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.strategy_modules
  WHERE client_id = p_client_id
  ORDER BY
    CASE module
      WHEN 'positioning' THEN 1
      WHEN 'pillars' THEN 2
      WHEN 'campaign_plan' THEN 3
      WHEN 'weekly_plan' THEN 4
      WHEN 'channel_adaptations' THEN 5
      WHEN 'rules_constraints' THEN 6
    END;
$$;

-- Helper function to upsert a strategy module
CREATE OR REPLACE FUNCTION public.upsert_strategy_module(
  p_client_id UUID,
  p_agency_id UUID,
  p_module public.strategy_module,
  p_content_json JSONB,
  p_status public.strategy_status DEFAULT 'draft',
  p_ai_generated BOOLEAN DEFAULT false,
  p_ai_confidence INTEGER DEFAULT NULL
)
RETURNS public.strategy_modules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_modules;
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.strategy_modules (
    client_id, agency_id, module, content_json, status,
    ai_generated, ai_confidence, created_by
  )
  VALUES (
    p_client_id, p_agency_id, p_module, p_content_json, p_status,
    p_ai_generated, p_ai_confidence, v_user_id
  )
  ON CONFLICT (client_id, module) DO UPDATE SET
    content_json = EXCLUDED.content_json,
    status = EXCLUDED.status,
    ai_generated = EXCLUDED.ai_generated,
    ai_confidence = EXCLUDED.ai_confidence,
    version = strategy_modules.version + 1,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Helper function to lock/unlock a strategy module
CREATE OR REPLACE FUNCTION public.toggle_strategy_module_lock(
  p_module_id UUID,
  p_lock BOOLEAN
)
RETURNS public.strategy_modules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_modules;
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE public.strategy_modules
  SET
    locked = p_lock,
    locked_at = CASE WHEN p_lock THEN now() ELSE NULL END,
    locked_by = CASE WHEN p_lock THEN v_user_id ELSE NULL END,
    status = CASE WHEN p_lock THEN 'locked'::public.strategy_status ELSE 'approved'::public.strategy_status END
  WHERE id = p_module_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Helper function to add history event
CREATE OR REPLACE FUNCTION public.add_strategy_history(
  p_client_id UUID,
  p_module_id UUID,
  p_module public.strategy_module,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
)
RETURNS public.strategy_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_history;
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.strategy_history (
    client_id, module_id, module, event_type, event_data, actor_id
  )
  VALUES (
    p_client_id, p_module_id, p_module, p_event_type, p_event_data, v_user_id
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
