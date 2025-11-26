import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PLAN_LIMITS } from "@/lib/plan-limits";

export default function BillingTab() {
  const { user } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);

  useEffect(() => {
    fetchUsageData();
  }, [user]);

  const fetchUsageData = async () => {
    if (!user) return;

    try {
      // Get agency ID
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agency) return;

      // Count clients
      const { count: clients } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agency.id);

      setClientCount(clients || 0);

      // Count team members
      const { count: team } = await supabase
        .from("agency_members")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agency.id);

      setTeamCount(team || 0);
    } catch (error: any) {
      console.error("Error fetching usage:", error);
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { planType: "pro", billingInterval: "monthly" },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to open billing portal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const planType = subscription?.plan_type || "free";
  const limits = PLAN_LIMITS[planType];
  const storageUsedGB = (subscription?.storage_used || 0) / (1024 * 1024 * 1024);
  const storageLimitGB = limits.storage ? limits.storage / (1024 * 1024 * 1024) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Manage your subscription and billing</CardDescription>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              {planType.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscription?.current_period_end && (
            <div>
              <p className="text-sm text-muted-foreground">Next billing date</p>
              <p className="text-lg font-medium">
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Clients</span>
                <span className="text-muted-foreground">
                  {clientCount} / {limits.clients === null ? "∞" : limits.clients}
                </span>
              </div>
              <Progress
                value={
                  limits.clients === null
                    ? 0
                    : (clientCount / limits.clients) * 100
                }
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Team Members</span>
                <span className="text-muted-foreground">
                  {teamCount} / {limits.teamMembers === null ? "∞" : limits.teamMembers}
                </span>
              </div>
              <Progress
                value={
                  limits.teamMembers === null
                    ? 0
                    : (teamCount / limits.teamMembers) * 100
                }
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Storage</span>
                <span className="text-muted-foreground">
                  {storageUsedGB.toFixed(2)} GB /{" "}
                  {storageLimitGB === null ? "∞" : `${storageLimitGB.toFixed(0)} GB`}
                </span>
              </div>
              <Progress
                value={
                  storageLimitGB === null
                    ? 0
                    : (storageUsedGB / storageLimitGB) * 100
                }
              />
            </div>
          </div>

          <div className="flex gap-3">
            {planType !== "agency_plus" && (
              <Button onClick={handleUpgrade} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CreditCard className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            )}
            <Button variant="outline" onClick={handleManageBilling} disabled={loading}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
