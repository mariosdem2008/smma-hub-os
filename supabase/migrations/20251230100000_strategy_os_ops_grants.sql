-- Strategy OS Ops - Grant permissions for strategies and strategy_decisions tables
-- The 20251230090000_strategy_os_ops.sql migration created these tables but forgot GRANT statements

-- Grant permissions on strategies table
GRANT SELECT, INSERT, UPDATE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;

-- Grant permissions on strategy_decisions table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_decisions TO authenticated;
GRANT ALL ON public.strategy_decisions TO service_role;

-- Grant execute on updated functions (with new signatures)
GRANT EXECUTE ON FUNCTION public.get_strategy_modules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_module(UUID, UUID, UUID, public.strategy_module, JSONB, public.strategy_status, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_strategy_history(UUID, UUID, UUID, public.strategy_module, TEXT, JSONB) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_strategy_modules(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_module(UUID, UUID, UUID, public.strategy_module, JSONB, public.strategy_status, BOOLEAN, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_strategy_history(UUID, UUID, UUID, public.strategy_module, TEXT, JSONB) TO service_role;