-- Strategy OS - Grant permissions to authenticated users
-- The original migration created tables and RLS policies but forgot GRANT statements

-- Grant permissions on strategy_modules
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_modules TO authenticated;
GRANT ALL ON public.strategy_modules TO service_role;

-- Grant permissions on strategy_history
GRANT SELECT, INSERT ON public.strategy_history TO authenticated;
GRANT ALL ON public.strategy_history TO service_role;

-- Grant permissions on strategy_tasks
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_tasks TO authenticated;
GRANT ALL ON public.strategy_tasks TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_strategy_modules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_module(UUID, UUID, public.strategy_module, JSONB, public.strategy_status, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_strategy_module_lock(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_strategy_history(UUID, UUID, public.strategy_module, TEXT, JSONB) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_strategy_modules(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_module(UUID, UUID, public.strategy_module, JSONB, public.strategy_status, BOOLEAN, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_strategy_module_lock(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_strategy_history(UUID, UUID, public.strategy_module, TEXT, JSONB) TO service_role;

-- Grant usage on sequences if any exist (auto-generated)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
