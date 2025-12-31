-- Strategy OS versioning, decisions, and integration extensions

-- 1) Strategies table
CREATE TABLE IF NOT EXISTS public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  version_int INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, version_int)
);

CREATE INDEX IF NOT EXISTS idx_strategies_client ON public.strategies(client_id);
CREATE INDEX IF NOT EXISTS idx_strategies_agency ON public.strategies(agency_id);

-- 2) Strategy decisions table
CREATE TABLE IF NOT EXISTS public.strategy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module public.strategy_module NOT NULL,
  decision_key TEXT NOT NULL,
  value JSONB DEFAULT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (strategy_id, module, decision_key)
);

CREATE INDEX IF NOT EXISTS idx_strategy_decisions_strategy ON public.strategy_decisions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_decisions_client ON public.strategy_decisions(client_id);

-- 3) Extend strategy_modules with strategy_id, blockers, and review tracking
ALTER TABLE public.strategy_modules
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES public.strategies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_strategy_modules_strategy ON public.strategy_modules(strategy_id);

-- Drop unique constraint on (client_id, module) if present
ALTER TABLE public.strategy_modules
  DROP CONSTRAINT IF EXISTS strategy_modules_client_id_module_key;

ALTER TABLE public.strategy_modules
  ADD CONSTRAINT strategy_modules_strategy_id_module_key UNIQUE (strategy_id, module);

-- 4) Extend strategy_history with strategy_id
ALTER TABLE public.strategy_history
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES public.strategies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_strategy_history_strategy ON public.strategy_history(strategy_id);

-- 5) Extend strategy_tasks for tasks + pipeline links
ALTER TABLE public.strategy_tasks
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES public.strategies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_key TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Update task status default/check to align with tasks table
ALTER TABLE public.strategy_tasks
  ALTER COLUMN status SET DEFAULT 'todo';

ALTER TABLE public.strategy_tasks
  DROP CONSTRAINT IF EXISTS strategy_tasks_status_check;

-- Backfill status values to new enum set
UPDATE public.strategy_tasks
SET status = CASE
  WHEN status IN ('todo', 'in_progress', 'completed', 'pushed') THEN status
  WHEN status = 'pending' THEN 'todo'
  ELSE 'todo'
END;

ALTER TABLE public.strategy_tasks
  ADD CONSTRAINT strategy_tasks_status_check CHECK (status IN ('todo', 'in_progress', 'completed', 'pushed'));

CREATE INDEX IF NOT EXISTS idx_strategy_tasks_strategy ON public.strategy_tasks(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_task ON public.strategy_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_project ON public.strategy_tasks(project_id);

ALTER TABLE public.strategy_tasks
  DROP CONSTRAINT IF EXISTS strategy_tasks_strategy_module_period_slug_key;

ALTER TABLE public.strategy_tasks
  ADD CONSTRAINT strategy_tasks_strategy_module_period_slug_key UNIQUE (strategy_id, module, period_key, slug);

-- 6) Backfill strategies for existing clients
INSERT INTO public.strategies (client_id, agency_id, version_int, status, created_at, updated_at)
SELECT DISTINCT sm.client_id, sm.agency_id, 1, 'active', now(), now()
FROM public.strategy_modules sm
ON CONFLICT (client_id, version_int) DO NOTHING;

-- 7) Backfill strategy_id on existing modules
UPDATE public.strategy_modules sm
SET strategy_id = s.id
FROM public.strategies s
WHERE sm.client_id = s.client_id
  AND s.version_int = 1
  AND sm.strategy_id IS NULL;

ALTER TABLE public.strategy_modules
  ALTER COLUMN strategy_id SET NOT NULL;

-- Normalize legacy status values
UPDATE public.strategy_modules
SET status = 'draft'
WHERE status = 'ai_draft';

-- 8) Backfill strategy_id on existing history rows
UPDATE public.strategy_history sh
SET strategy_id = sm.strategy_id
FROM public.strategy_modules sm
WHERE sh.module_id = sm.id
  AND sh.strategy_id IS NULL;

UPDATE public.strategy_history sh
SET strategy_id = s.id
FROM public.strategies s
WHERE sh.strategy_id IS NULL
  AND sh.client_id = s.client_id
  AND s.version_int = 1;

-- 9) Backfill strategy_id on existing tasks
UPDATE public.strategy_tasks st
SET strategy_id = sm.strategy_id
FROM public.strategy_modules sm
WHERE st.module_id = sm.id
  AND st.strategy_id IS NULL;

UPDATE public.strategy_tasks st
SET strategy_id = s.id
FROM public.strategies s
WHERE st.strategy_id IS NULL
  AND st.client_id = s.client_id
  AND s.version_int = 1;

-- 10) Update updated_at trigger function to track last_updated_at
CREATE OR REPLACE FUNCTION public.update_strategy_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_TABLE_NAME = 'strategy_modules' THEN
    NEW.last_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11) Strategy table updated_at trigger
CREATE OR REPLACE FUNCTION public.update_strategies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS strategies_updated_at ON public.strategies;
CREATE TRIGGER strategies_updated_at
  BEFORE UPDATE ON public.strategies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategies_updated_at();

DROP TRIGGER IF EXISTS strategy_decisions_updated_at ON public.strategy_decisions;
CREATE TRIGGER strategy_decisions_updated_at
  BEFORE UPDATE ON public.strategy_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategies_updated_at();

-- 12) Update RPC functions to include strategy_id
DROP FUNCTION IF EXISTS public.get_strategy_modules(UUID);
CREATE OR REPLACE FUNCTION public.get_strategy_modules(p_strategy_id UUID)
RETURNS SETOF public.strategy_modules
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.strategy_modules
  WHERE strategy_id = p_strategy_id
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

CREATE OR REPLACE FUNCTION public.upsert_strategy_module(
  p_client_id UUID,
  p_agency_id UUID,
  p_strategy_id UUID,
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
    client_id, agency_id, strategy_id, module, content_json, status,
    ai_generated, ai_confidence, created_by
  )
  VALUES (
    p_client_id, p_agency_id, p_strategy_id, p_module, p_content_json, p_status,
    p_ai_generated, p_ai_confidence, v_user_id
  )
  ON CONFLICT (strategy_id, module) DO UPDATE SET
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
    status = CASE WHEN p_lock THEN 'locked'::public.strategy_status ELSE status END
  WHERE id = p_module_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_strategy_history(
  p_client_id UUID,
  p_strategy_id UUID,
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
    client_id, strategy_id, module_id, module, event_type, event_data, actor_id
  )
  VALUES (
    p_client_id, p_strategy_id, p_module_id, p_module, p_event_type, p_event_data, v_user_id
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 13) RLS policies for strategies and decisions
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategies_select ON public.strategies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategies.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategies_insert ON public.strategies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategies.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategies_update ON public.strategies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategies.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_decisions_select ON public.strategy_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_decisions.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_decisions_insert ON public.strategy_decisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_decisions.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_decisions_update ON public.strategy_decisions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_decisions.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_decisions_delete ON public.strategy_decisions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_decisions.client_id
        AND am.user_id = auth.uid()
    )
  );
