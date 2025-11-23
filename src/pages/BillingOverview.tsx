import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubscription } from '@/hooks/useSubscription';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { PLAN_NAMES, formatStorageSize } from '@/lib/plan-limits';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CreditCard, Users, FolderOpen, Building2, Lock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { BillingReadOnlyBanner } from '@/components/billing/BillingReadOnlyBanner';

export default function BillingOverview() {
  const { subscription, loading } = useSubscription();
  const { limits } = usePlanLimits();
  const [usage, setUsage] = useState({ clients: 0, teamMembers: 0 });
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      if (!subscription) return;

      try {
        const { data: membership } = await supabase
          .from('agency_members')
          .select('agency_id')
          .eq('user_id', subscription.user_id)
          .single();

        if (!membership) return;

        const { count: clientCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', membership.agency_id);

        const { count: memberCount } = await supabase
          .from('agency_members')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', membership.agency_id);

        setUsage({
          clients: clientCount || 0,
          teamMembers: memberCount || 0,
        });
      } catch (error) {
        console.error('Error fetching usage:', error);
      } finally {
        setLoadingUsage(false);
      }
    };

    fetchUsage();
  }, [subscription]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Subscription Found</CardTitle>
            <CardDescription>Please contact support if you believe this is an error.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const storagePercent = limits?.storage
    ? Math.round((subscription.storage_used / limits.storage) * 100)
    : 0;

  const clientPercent = limits?.clients
    ? Math.round((usage.clients / limits.clients) * 100)
    : 0;

  const memberPercent = limits?.teamMembers
    ? Math.round((usage.teamMembers / limits.teamMembers) * 100)
    : 0;

  const lockedFeatures = [
    { name: 'White-label', locked: !limits?.features.whiteLabel },
    { name: 'Approval Workflows', locked: !limits?.features.approvalWorkflows },
    { name: 'Bulk Actions', locked: !limits?.features.bulkActions },
    { name: 'Advanced Automation', locked: !limits?.features.automation },
    { name: 'Multi-admin', locked: !limits?.features.multiAdmin },
  ].filter(f => f.locked);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing Overview</h1>
        <p className="text-muted-foreground">View your subscription and usage details</p>
      </div>

      <BillingReadOnlyBanner />

      {/* Current Plan */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription className="mt-2">
                {subscription.current_period_end
                  ? `Next billing date: ${format(new Date(subscription.current_period_end), 'PPP')}`
                  : 'No billing date set'}
              </CardDescription>
            </div>
            <div className="text-right">
              <Badge variant="default" className="text-lg px-4 py-1">
                {PLAN_NAMES[subscription.plan_type]}
              </Badge>
              <div className="mt-2">
                <Badge variant={subscription.status === 'active' ? 'default' : 'destructive'}>
                  {subscription.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="default" disabled className="w-full">
                  <Lock className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Only the agency owner can manage billing.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Usage & Limits</CardTitle>
          <CardDescription>Your current resource usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Clients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Clients</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {loadingUsage ? '...' : usage.clients} / {limits?.clients || '∞'}
              </span>
            </div>
            <Progress value={clientPercent} className="h-2" />
            {clientPercent >= 80 && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Nearing client limit
              </p>
            )}
          </div>

          {/* Team Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Team Members</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {loadingUsage ? '...' : usage.teamMembers} / {limits?.teamMembers || '∞'}
              </span>
            </div>
            <Progress value={memberPercent} className="h-2" />
            {memberPercent >= 80 && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Nearing team limit
              </p>
            )}
          </div>

          {/* Storage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Storage</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatStorageSize(subscription.storage_used)} /{' '}
                {limits?.storage ? formatStorageSize(limits.storage) : '∞'}
              </span>
            </div>
            <Progress value={storagePercent} className="h-2" />
            {storagePercent >= 80 && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Storage nearly full
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Locked Features */}
      {lockedFeatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Locked Features</CardTitle>
            <CardDescription>Features available on higher plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lockedFeatures.map((feature) => (
                <div key={feature.name} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>{feature.name}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium mb-2">Want to unlock these features?</p>
              <p className="text-xs text-muted-foreground mb-3">
                Ask your agency owner to upgrade to a higher plan to access these premium features.
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" disabled className="w-full">
                      <Lock className="h-4 w-4 mr-2" />
                      Request Upgrade
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Only the agency owner can upgrade the plan.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
