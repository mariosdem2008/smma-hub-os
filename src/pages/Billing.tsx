import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Infinity as InfinityIcon,
  Loader2,
  Lock,
  Sparkles,
  TrendingUp,
  Users,
  Building2,
  FolderOpen,
} from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { NoPermissionModal } from "@/components/billing/NoPermissionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useRole } from "@/hooks/useRole";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_NAMES, PLAN_PRICES, canUpgrade, formatStorageSize, getNextPlan } from "@/lib/plan-limits";

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

export default function Billing() {
  const navigate = useNavigate();
  const { subscription, loading, refreshSubscription } = useSubscription();
  const { limits } = usePlanLimits();
  const { role, loading: roleLoading, isOwner } = useRole();

  const [usage, setUsage] = useState<UsageState>({ clients: 0, teamMembers: 0, aiGenerations: 0 });
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [showNoPermission, setShowNoPermission] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true" || params.get("checkout") === "success") {
      refreshSubscription();
      window.history.replaceState({}, "", "/billing");
    }
  }, [refreshSubscription]);

  useEffect(() => {
    if (!roleLoading && !isOwner) {
      if (role === "admin") navigate("/billing/overview", { replace: true });
      else setShowNoPermission(true);
    }
  }, [roleLoading, isOwner, role, navigate]);

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
        console.error("Error fetching billing usage", error);
      } finally {
        setLoadingUsage(false);
      }
    };

    void fetchUsage();
  }, [subscription]);

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error) {
      console.error("Error opening billing portal", error);
    } finally {
      setManagingSubscription(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showNoPermission) {
    return (
      <NoPermissionModal
        open={showNoPermission}
        onOpenChange={(open) => {
          setShowNoPermission(open);
          if (!open) navigate("/dashboard", { replace: true });
        }}
      />
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
  const isActive = subscription.status === "active";
  const isLifetime = subscription.plan_type.startsWith("ltd");
  const nextPlan = getNextPlan(subscription.plan_type);
  const canMoveUp = canUpgrade(subscription.plan_type);
  const currentPrice = subscription.plan_type !== "free" ? PLAN_PRICES[subscription.plan_type as keyof typeof PLAN_PRICES] : null;
  const daysUntilRenewal = subscription.current_period_end
    ? differenceInDays(new Date(subscription.current_period_end), new Date())
    : null;

  const clientPercent = limits?.clients ? clamp(Math.round((usage.clients / limits.clients) * 100)) : 0;
  const memberPercent = limits?.teamMembers ? clamp(Math.round((usage.teamMembers / limits.teamMembers) * 100)) : 0;
  const storagePercent = limits?.storage ? clamp(Math.round((subscription.storage_used / limits.storage) * 100)) : 0;
  const aiQuota = AI_QUOTAS[subscription.plan_type] ?? AI_QUOTAS.free;
  const aiPercent = clamp(Math.round((usage.aiGenerations / aiQuota) * 100));

  const usagePressure = Math.max(clientPercent, memberPercent, storagePercent, aiPercent);
  const openRisks = [clientPercent, memberPercent, storagePercent, aiPercent].filter((value) => value >= 85).length;

  const priceLabel = currentPrice ? `EUR ${currentPrice.monthly}/mo` : "Free";
  const renewal = isLifetime
    ? "lifetime license"
    : subscription.current_period_end
    ? `renews on ${format(new Date(subscription.current_period_end), "MMM d, yyyy")}`
    : "no renewal date";
  const billingSummary = `${planLabel} (${priceLabel}), ${renewal}. Usage pressure is ${usagePressure}% with ${openRisks} active billing risk signal(s).`;

  const usageCards = [
    {
      id: "clients",
      label: "Clients",
      icon: Building2,
      current: usage.clients,
      limit: limits?.clients ?? null,
      percent: clientPercent,
      helper: "Client seats in your plan",
    },
    {
      id: "team",
      label: "Team Members",
      icon: Users,
      current: usage.teamMembers,
      limit: limits?.teamMembers ?? null,
      percent: memberPercent,
      helper: "Internal team seats",
    },
    {
      id: "storage",
      label: "Storage",
      icon: FolderOpen,
      current: formatStorageSize(subscription.storage_used),
      limit: limits?.storage ? formatStorageSize(limits.storage) : null,
      percent: storagePercent,
      helper: "Media and file storage",
    },
    {
      id: "ai",
      label: "AI Generations",
      icon: Sparkles,
      current: usage.aiGenerations,
      limit: aiQuota,
      percent: aiPercent,
      helper: "Monthly AI generation budget",
    },
  ] as const;

  const planFeatures = limits?.features ?? {};
  const lockedFeatures = [
    { key: "whiteLabel", label: "White-label workspace" },
    { key: "approvalWorkflows", label: "Approval workflows" },
    { key: "bulkActions", label: "Bulk operations" },
    { key: "templates", label: "Template libraries" },
    { key: "automation", label: "Automation engine" },
    { key: "multiAdmin", label: "Multi-admin controls" },
  ].map((feature) => ({
    ...feature,
    enabled: Boolean((planFeatures as Record<string, unknown>)[feature.key]),
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/55">Enterprise Billing</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Billing Command Center</h1>
            <p className="mt-1 text-sm text-white/65">Plan, usage, and payment controls for high-scale agencies.</p>
          </div>
          <Badge className="bg-primary/25 text-primary-foreground border border-primary/40">Owner Access</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Current Plan</CardDescription>
            <CardTitle className="text-xl text-white">{planLabel}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">{isLifetime ? "Lifetime" : "Subscription"}</CardContent>
        </Card>
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Monthly Price</CardDescription>
            <CardTitle className="text-xl text-white">{currentPrice ? `EUR ${currentPrice.monthly}` : "Free"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">per month</CardContent>
        </Card>
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Renewal Window</CardDescription>
            <CardTitle className="text-xl text-white">{isLifetime ? "N/A" : daysUntilRenewal ?? "-"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">days remaining</CardContent>
        </Card>
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Usage Pressure</CardDescription>
            <CardTitle className="text-xl text-white">{usagePressure}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">highest resource pressure</CardContent>
        </Card>
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-white/60">Risk Signals</CardDescription>
            <CardTitle className="text-xl text-white">{openRisks}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-white/55">limits above 85%</CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-[520px] grid-cols-4 border border-white/15 bg-black/40">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <Card className="border-white/10 bg-black/40">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-white">Plan Status</CardTitle>
                  <CardDescription className="text-white/60">
                    {isLifetime
                      ? "Lifetime access active"
                      : subscription.current_period_end
                      ? `Renews on ${format(new Date(subscription.current_period_end), "MMM d, yyyy")}`
                      : "No billing cycle date found"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isActive ? "secondary" : "destructive"}>{subscription.status}</Badge>
                  {subscription.stripe_customer_id ? <Badge variant="outline">Stripe Connected</Badge> : <Badge variant="outline">No Stripe Customer</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-white/75">{billingSummary}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => navigate("/pricing")}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Change Plan
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white"
                  onClick={handleManageSubscription}
                  disabled={!subscription.stripe_customer_id || managingSubscription}
                >
                  {managingSubscription ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>

          {canMoveUp && nextPlan ? (
            <Card className="border-primary/40 bg-primary/10">
              <CardHeader>
                <CardTitle className="text-white">Upgrade Opportunity</CardTitle>
                <CardDescription className="text-white/70">
                  {PLAN_NAMES[nextPlan]} unlocks higher limits and enterprise controls.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-white/80">
                  Starts at EUR {PLAN_PRICES[nextPlan as keyof typeof PLAN_PRICES]?.monthly ?? 0}/month
                </div>
                <Button onClick={() => navigate("/pricing")}>
                  View Plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-white/10 bg-black/40">
            <CardHeader>
              <CardTitle className="text-white">Feature Access</CardTitle>
              <CardDescription className="text-white/60">Capabilities available on your current plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {lockedFeatures.map((feature) => (
                  <div key={feature.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm text-white/85">{feature.label}</span>
                    {feature.enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Lock className="h-4 w-4 text-white/45" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6 pt-4">
          <Card className="border-white/10 bg-black/40">
            <CardHeader>
              <CardTitle className="text-white">Resource Consumption</CardTitle>
              <CardDescription className="text-white/60">Track consumption against plan limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {usageCards.map((item) => {
                const isHigh = item.percent >= 85;
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-white/70" />
                        <span className="text-sm text-white">{item.label}</span>
                      </div>
                      <span className="text-sm text-white/70">
                        {loadingUsage ? "..." : item.current} / {item.limit ?? <InfinityIcon className="inline h-4 w-4" />}
                      </span>
                    </div>
                    <Progress value={item.percent} className="h-2" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/50">{item.helper}</span>
                      {isHigh ? (
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          Near limit
                        </span>
                      ) : (
                        <span className="text-emerald-400">Healthy</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6 pt-4">
          <Card className="border-white/10 bg-black/40">
            <CardHeader>
              <CardTitle className="text-white">Invoices & Billing History</CardTitle>
              <CardDescription className="text-white/60">
                Invoices are managed in Stripe portal for security and compliance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Invoice Center</span>
                </div>
                <p className="mt-2 text-sm text-white/65">
                  Open the customer portal to view or download invoices, receipts, and full payment history.
                </p>
              </div>

              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white"
                onClick={handleManageSubscription}
                disabled={!subscription.stripe_customer_id || managingSubscription}
              >
                {managingSubscription ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                Open Invoice Portal
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6 pt-4">
          <Card className="border-white/10 bg-black/40">
            <CardHeader>
              <CardTitle className="text-white">Payment Methods</CardTitle>
              <CardDescription className="text-white/60">Securely managed by Stripe customer portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription.stripe_customer_id ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                    Add, remove, or update payment methods through Stripe. This keeps card data outside app storage.
                  </div>
                  <Button
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white"
                    onClick={handleManageSubscription}
                    disabled={managingSubscription}
                  >
                    {managingSubscription ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Manage Payment Methods
                  </Button>
                </>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
                  No Stripe customer record is linked yet. Start or upgrade a subscription to enable payment management.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Clock className="h-4 w-4" />
          SLA: billing portal actions usually sync within 1-2 minutes.
        </div>
      </div>
    </div>
  );
}
