import { useEffect } from 'react';
import { useUpgradeAssistant } from '@/contexts/UpgradeAssistantContext';
import { useSubscription } from '@/hooks/useSubscription';
import { usePlanLimits } from '@/hooks/usePlanLimits';

export function useUpgradeAssistantTriggers() {
  const { triggerAssistant } = useUpgradeAssistant();
  const { subscription } = useSubscription();
  const { limits } = usePlanLimits();

  useEffect(() => {
    if (!subscription || !limits) return;

    // Time trigger: 72 hours after account creation
    const accountAge = Date.now() - new Date(subscription.created_at).getTime();
    const hoursOld = accountAge / (1000 * 60 * 60);
    
    if (hoursOld >= 72 && hoursOld < 73 && subscription.plan_type === 'free') {
      const hasSeenTimeTrigger = localStorage.getItem('upgrade_assistant_time_trigger');
      if (!hasSeenTimeTrigger) {
        triggerAssistant('time_trigger_72h');
        localStorage.setItem('upgrade_assistant_time_trigger', 'true');
      }
    }

    // Storage trigger: 80% of limit
    if (limits.storage !== null && subscription.storage_used >= limits.storage * 0.8) {
      const lastStorageTrigger = localStorage.getItem('upgrade_assistant_storage_trigger');
      const now = Date.now();
      if (!lastStorageTrigger || now - parseInt(lastStorageTrigger) > 24 * 60 * 60 * 1000) {
        triggerAssistant('storage_near_limit');
        localStorage.setItem('upgrade_assistant_storage_trigger', now.toString());
      }
    }
  }, [subscription, limits, triggerAssistant]);
}
