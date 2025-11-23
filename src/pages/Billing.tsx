import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/useSubscription';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { PLAN_NAMES, formatStorageSize } from '@/lib/plan-limits';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CreditCard, Users, FolderOpen, Building2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Billing() {
  const navigate = useNavigate();
  const { subscription, loading } = useSubscription();
  const { limits } = usePlanLimits();
  const [usage, setUsage] = useState({ clients: 0, teamMembers: 0 });
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      if (!subscription) return;

      try {
        // Get agency_id for current user
        const { data: membership } = await supabase
          .from('agency_members')
          .select('agency_id')
          .eq('user_id', subscription.user_id)
          .single();

        if (!membership) return;

        // Count clients
        const { count: clientCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', membership.agency_id);

        // Count team members
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and view usage</p>
      </div>

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
                  : subscription.plan_type.startsWith('ltd')
                  ? 'Lifetime access - no recurring billing'
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
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={() => navigate('/pricing')} variant="default">
              Change Plan
            </Button>
            {subscription.stripe_customer_id && (
              <Button variant="outline" onClick={() => {
                // TODO: Open Stripe customer portal
              }}>
                Manage Subscription
              </Button>
            )}
          </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Features</CardTitle>
          <CardDescription>Features included in your current plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Badge variant={limits?.features.whiteLabel ? 'default' : 'secondary'}>
                {limits?.features.whiteLabel ? '✓' : '✗'}
              </Badge>
              <span>White-label</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={limits?.features.approvalWorkflows ? 'default' : 'secondary'}>
                {limits?.features.approvalWorkflows ? '✓' : '✗'}
              </Badge>
              <span>Approval Workflows</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={limits?.features.bulkActions ? 'default' : 'secondary'}>
                {limits?.features.bulkActions ? '✓' : '✗'}
              </Badge>
              <span>Bulk Actions</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={limits?.features.templates ? 'default' : 'secondary'}>
                {limits?.features.templates ? '✓' : '✗'}
              </Badge>
              <span>Templates Library</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={limits?.features.automation ? 'default' : 'secondary'}>
                {limits?.features.automation ? '✓' : '✗'}
              </Badge>
              <span>Automation</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={limits?.features.multiAdmin ? 'default' : 'secondary'}>
                {limits?.features.multiAdmin ? '✓' : '✗'}
              </Badge>
              <span>Multi-admin</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
