-- Drop non-MVP tables
DROP TABLE IF EXISTS public.client_brand_voice CASCADE;
DROP TABLE IF EXISTS public.agency_branding CASCADE;
DROP TABLE IF EXISTS public.client_approval_workflows CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.client_inspiration CASCADE;
DROP TABLE IF EXISTS public.client_saved_captions CASCADE;
DROP TABLE IF EXISTS public.client_content_pillars CASCADE;

-- Drop multi-approval triggers and functions
DROP TRIGGER IF EXISTS create_approval_tasks_trigger ON public.assets;
DROP TRIGGER IF EXISTS handle_approval_update_trigger ON public.approval_tasks;
DROP FUNCTION IF EXISTS public.create_approval_tasks_for_asset() CASCADE;
DROP FUNCTION IF EXISTS public.handle_approval_task_update() CASCADE;
DROP FUNCTION IF EXISTS public.get_next_approver(uuid, uuid) CASCADE;

-- Simplify approval_tasks to single-step only
-- Keep the table but it's now just a simple approve/reject record