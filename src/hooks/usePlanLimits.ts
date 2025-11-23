import { useMemo } from 'react';
import { useSubscription } from './useSubscription';
import { PLAN_LIMITS, PlanLimits } from '@/lib/plan-limits';

export function usePlanLimits(): { limits: PlanLimits | null; loading: boolean } {
  const { subscription, loading } = useSubscription();

  const limits = useMemo(() => {
    if (!subscription) return PLAN_LIMITS.free;
    return PLAN_LIMITS[subscription.plan_type];
  }, [subscription]);

  return { limits, loading };
}
