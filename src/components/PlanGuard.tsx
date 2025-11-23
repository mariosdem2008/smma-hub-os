import { ReactNode, useEffect, useState } from 'react';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { UpgradeModal } from './UpgradeModal';
import { toast } from 'sonner';

interface PlanGuardProps {
  children: ReactNode;
  feature: 'clients' | 'teamMembers' | 'storage' | 'whiteLabel' | 'approvalWorkflows' | 'bulkActions';
  requiredPlan?: 'starter' | 'pro' | 'agency_plus';
  onBlock?: () => void;
}

export function PlanGuard({ children, feature, requiredPlan = 'starter', onBlock }: PlanGuardProps) {
  const { user } = useAuth();
  const { limits, loading } = usePlanLimits();
  const { subscription } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [currentUsage, setCurrentUsage] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkUsage = async () => {
      if (!user || !subscription || loading) return;

      try {
        // Get agency_id
        const { data: membership } = await supabase
          .from('agency_members')
          .select('agency_id')
          .eq('user_id', user.id)
          .single();

        if (!membership) return;

        if (feature === 'clients') {
          const { count } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('agency_id', membership.agency_id);
          setCurrentUsage(count || 0);
        } else if (feature === 'teamMembers') {
          const { count } = await supabase
            .from('agency_members')
            .select('*', { count: 'exact', head: true })
            .eq('agency_id', membership.agency_id);
          setCurrentUsage(count || 0);
        } else if (feature === 'storage') {
          setCurrentUsage(subscription.storage_used);
        }
      } catch (error) {
        console.error('Error checking usage:', error);
      } finally {
        setChecking(false);
      }
    };

    checkUsage();
  }, [user, subscription, feature, loading]);

  const handleClick = (e: React.MouseEvent) => {
    if (loading || checking) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Check feature flags
    if (feature === 'whiteLabel' && !limits?.features.whiteLabel) {
      e.preventDefault();
      e.stopPropagation();
      toast.error('White-label requires ' + requiredPlan + ' plan or higher');
      setShowUpgrade(true);
      onBlock?.();
      return;
    }

    if (feature === 'approvalWorkflows' && !limits?.features.approvalWorkflows) {
      e.preventDefault();
      e.stopPropagation();
      toast.error('Approval workflows require ' + requiredPlan + ' plan or higher');
      setShowUpgrade(true);
      onBlock?.();
      return;
    }

    if (feature === 'bulkActions' && !limits?.features.bulkActions) {
      e.preventDefault();
      e.stopPropagation();
      toast.error('Bulk actions require ' + requiredPlan + ' plan or higher');
      setShowUpgrade(true);
      onBlock?.();
      return;
    }

    // Check numeric limits
    if (feature === 'clients' && limits?.clients !== null && currentUsage >= limits.clients) {
      e.preventDefault();
      e.stopPropagation();
      toast.error('You have reached your client limit (' + limits.clients + '). Upgrade to add more clients.');
      setShowUpgrade(true);
      onBlock?.();
      return;
    }

    if (feature === 'teamMembers' && limits?.teamMembers !== null && currentUsage >= limits.teamMembers) {
      e.preventDefault();
      e.stopPropagation();
      toast.error('You have reached your team member limit (' + limits.teamMembers + '). Upgrade to add more members.');
      setShowUpgrade(true);
      onBlock?.();
      return;
    }

    if (feature === 'storage' && limits?.storage !== null && currentUsage >= limits.storage) {
      e.preventDefault();
      e.stopPropagation();
      toast.error('You have reached your storage limit. Upgrade to get more storage.');
      setShowUpgrade(true);
      onBlock?.();
      return;
    }
  };

  return (
    <>
      <div onClick={handleClick}>
        {children}
      </div>
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        feature={feature}
        requiredPlan={requiredPlan}
      />
    </>
  );
}
