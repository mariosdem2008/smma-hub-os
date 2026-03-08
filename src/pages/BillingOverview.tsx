import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  FolderOpen,
  Infinity as InfinityIcon,
  Loader2,
  Lock,
  Sparkles,
  Users,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PLAN_NAMES, formatStorageSize } from "@/lib/plan-limits";
import { supabase } from "@/integrations/supabase/client";
import { BillingReadOnlyBanner } from "@/components/billing/BillingReadOnlyBanner";

type UsageState = {
  clients: number;
  teamMembers: number;
  aiGenerations: number;
};

const AI_QUOTAS: Record<string, number> = {
  free: 20,
  starter: 200,
  pro: 500,
  agency_plus: 1500,
  ltd_starter: 200,
  ltd_pro: 500,
  ltd_agency_plus: 1500,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export default function BillingOverview() {
  const { subscription, loading } = useSubscription();
  const { limits } = usePlanLimits();
  const [usage, setUsage] = useState<UsageState>({ clients: 0, teamMembers: 0, aiGenerations: 0 });
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      if (!subscription) return;
      try {
        const { data: membership } = await supabase
          .from("agency_members")
          .select("agency_id")
          .eq("user_id", subscription.user_id)
          .single();

        if (!membership?.agency_id) {
          setLoadingUsage(false);
          return;
        }

        const [clientRes, teamRes, aiRes] = await Promise.all([
          supabase.from("clients").select("*", { count: "exact", head: true }).eq("agency_id", membership.agency_id),
          supabase.from("agency_members").select("*", { count: "exact", head: true }).eq("agency_id", membership.agency_id),
          supabase.rpc("get_monthly_ai_usage", { p_agency_id: membership.agency_id }),
        ]);

        setUsage({
          clients: clientRes.count || 0,
          teamMembers: teamRes.count || 0,
          aiGenerations: typeof aiRes.data === "number" ? aiRes.data : 0,
        });
      } catch (error) {
        console.error("Error fetching billing overview usage:", error);
      } finally {
        setLoadingUsage(false);
      }
    };

    void fetchUsage();
  }, [subscription]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Subscription Found</CardTitle>
          <CardDescription>Please contact support if you believe this is an error.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const planLabel = PLAN_NAMES[subscription.plan_type] ?? subscription.plan_type ?? "Unknown";
  const aiQuota = AI_QUOTAS[subscription.plan_type] ?? AI_QUOTAS.free;
  const clientPercent = limits?.clients ? clamp(Math.round((usage.clients / limits.clients) * 100)) : 0;
  const teamPercent = limits?.teamMembers ? clamp(Math.round((usage.teamMembers / limits.teamMembers) * 100)) : 0;
  const storagePercent = limits?.storage ? clamp(Math.round((subscription.storage_used / limits.storage) * 100)) : 0;
  const aiPercent = clamp(Math.round((usage.aiGenerations / aiQuota) * 100));

  const highestPressure = Math.max(clientPercent, teamPercent, storagePercent, aiPercent);
  const planFeatures = limits?.features ?? {};
  const lockedFeatures = [
    { key: "whiteLabel", label: "White-label" },
    { key: "approvalWorkflows", label: "Approval workflows" },
    { key: "bulkActions", label: "Bulk actions" },
    { key: "automation", label: "Automation" },
    { key: "multiAdmin", label: "Multi-admin" },
  ].filter((feature) => !(planFeatures as Record<string, unknown>)[feature.key]);

  const summary = `${planLabel} plan with ${highestPressure}% peak usage pressure. ${lockedFeatures.length} premium feature(s) locked on current tier.`;

  const usageRows = [
    {
      label: "Clients",
      icon: Building2,
      current: usage.clients,
      limit: limits?.clients ?? null,
      percent: clientPercent,
    },
    {
      label: "Team Members",
      icon: Users,
      current: usage.teamMembers,
      limit: limits?.teamMembers ?? null,
      percent: teamPercent,
    },
    {
      label: "Storage",
      icon: FolderOpen,
      current: formatStorageSize(subscription.storage_used),
      limit: limits?.storage ? formatStorageSize(limits.storage) : null,
      percent: storagePercent,
    },
    {
      label: "AI Generations (Monthly)",
      icon: Sparkles,
      current: usage.aiGenerations,
      limit: aiQuota,
      percent: aiPercent,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-sm">
        <div className="text-xs uppercase tracking-[0.2em] text-white/55">Billing Overview</div>
        <h1 className="mt-1 text-2xl font-semibold text-white">Read-Only Billing Console</h1>
        <p className="mt-1 text-sm text-white/65">Subscription visibility for admins. Owner permission required for billing actions.</p>
      </div>

      <BillingReadOnlyBanner />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Plan</CardDescription>
            <CardTitle className="text-white">{planLabel}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">{subscription.status}</CardContent>
        </Card>
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Next Billing Date</CardDescription>
            <CardTitle className="text-white">
              {subscription.current_period_end ? format(new Date(subscription.current_period_end), "MMM d, yyyy") : "N/A"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">renewal schedule</CardContent>
        </Card>
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Usage Pressure</CardDescription>
            <CardTitle className="text-white">{highestPressure}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">max utilization</CardContent>
        </Card>
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Locked Features</CardDescription>
            <CardTitle className="text-white">{lockedFeatures.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">upgrade required</CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-black/40">
        <CardHeader>
          <CardTitle className="text-white">Executive Snapshot</CardTitle>
          <CardDescription className="text-white/60">{summary}</CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-white/10 bg-black/40">
        <CardHeader>
          <CardTitle className="text-white">Usage & Limits</CardTitle>
          <CardDescription className="text-white/60">Current account consumption against plan allowances.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {usageRows.map((row) => (
            <div key={row.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <row.icon className="h-4 w-4 text-white/70" />
                  <span className="text-sm">{row.label}</span>
                </div>
                <span className="text-sm text-white/65">
                  {loadingUsage ? "..." : row.current} / {row.limit ?? <InfinityIcon className="inline h-4 w-4" />}
                </span>
              </div>
              <Progress value={row.percent} className="h-2" />
              {row.percent >= 80 ? (
                <div className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  Nearing limit
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {lockedFeatures.length > 0 ? (
        <Card className="border-white/10 bg-black/40">
          <CardHeader>
            <CardTitle className="text-white">Features Locked on Current Plan</CardTitle>
            <CardDescription className="text-white/60">Visible for planning. Owner can upgrade to unlock.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {lockedFeatures.map((feature) => (
                <div key={feature.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-sm text-white/80">{feature.label}</span>
                  <Lock className="h-4 w-4 text-white/45" />
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-4 border-white/20 bg-white/5 text-white" disabled>
              <Lock className="mr-2 h-4 w-4" />
              Owner-Only Upgrade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-400/40 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="text-emerald-100">All plan features unlocked</CardTitle>
            <CardDescription className="text-emerald-100/80">No feature restrictions detected for this account.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card className="border-white/10 bg-black/30">
        <CardContent className="flex items-start gap-2 p-4 text-sm text-white/65">
          <CreditCard className="mt-0.5 h-4 w-4" />
          Billing actions (plan changes, invoices, payment methods) are intentionally disabled in read-only mode.
        </CardContent>
      </Card>
    </div>
  );
}
