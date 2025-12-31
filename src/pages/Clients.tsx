import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { hapticButton } from "@/lib/haptics";
import { Plus, Users, AlertCircle, ArrowRight, FileText, Video } from "lucide-react";
import { PlanGuard } from "@/components/PlanGuard";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { listClientsForMyAgency, createClientForMyAgency } from "@/data";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  created_at: string;
  logo_url: string | null;
  assetCount?: number;
  publishedVideoCount?: number;
}

export default function Clients() {
  const { user } = useAuth();
  const { canManageClients } = useRole();
  const { limits } = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "active",
    onboardingMode: "agency",
  });
  const [submitting, setSubmitting] = useState(false);
  const [countsAvailable, setCountsAvailable] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [readinessFilter, setReadinessFilter] = useState("all");
  const [sortMode, setSortMode] = useState("readiness");

  const isAtLimit = limits?.clients !== null && clients.length >= limits.clients;


  function getReadinessSignals(client: Client) {
    const hasContact = Boolean(client?.email) || Boolean(client?.phone);
    const hasAssets = (client?.assetCount || 0) > 0;
    const hasPublished = (client?.publishedVideoCount || 0) > 0;
    const trueCount = Number(hasContact) + Number(hasAssets) + Number(hasPublished);

    if (trueCount === 0) {
      return { status: "NOT_STARTED", hasContact, hasAssets, hasPublished, trueCount };
    }
    if (trueCount === 1) {
      return { status: "IN_PROGRESS", hasContact, hasAssets, hasPublished, trueCount };
    }
    return { status: "COMPLETE", hasContact, hasAssets, hasPublished, trueCount };
  }

  function getReadinessVariant(status: string) {
    if (status === "NOT_STARTED") return "outline";
    if (status === "IN_PROGRESS") return "orange";
    return "green";
  }

  function getStrategyHint(readiness: ReturnType<typeof getReadinessSignals>) {
    if (readiness.status === "NOT_STARTED") return "Needs onboarding to unlock strategy";
    if (readiness.status === "COMPLETE") return "Ready for Strategy";

    const missing: string[] = [];
    if (!readiness.hasContact) missing.push("contact");
    if (!readiness.hasAssets) missing.push("assets");
    if (!readiness.hasPublished) missing.push("published");
    return `Missing: ${missing.join(", ")}`;
  }

  function getNextStep(readiness: ReturnType<typeof getReadinessSignals>) {
    if (!readiness.hasContact) return "Next: add contact info";
    if (!readiness.hasAssets) return "Next: add assets";
    if (!readiness.hasPublished) return "Next: publish a post";
    return "Next: run strategy";
  }

  const fetchClients = async () => {
    if (!user) return;

    try {
      // Get clients using data layer
      const clientsData = await listClientsForMyAgency();
      const clientIds = clientsData.map((client) => client.id);
      setCountsAvailable(true);

      if (clientIds.length === 0) {
        setClients([]);
        return;
      }

      const { data: countsData, error: countsError } = await supabase
        .from("client_asset_counts")
        .select("client_id, asset_count, published_video_count")
        .in("client_id", clientIds);

      if (countsError) {
        console.warn("client asset counts warning:", countsError.message);
        setCountsAvailable(false);
      }

      const countsByClientId = new Map(
        (countsData || []).map((row: any) => [
          row.client_id,
          {
            assetCount: row.asset_count || 0,
            publishedVideoCount: row.published_video_count || 0,
          },
        ]),
      );

      const clientsWithCounts = clientsData.map((client) => ({
        ...client,
        status: client.status || "active",
        assetCount: countsByClientId.get(client.id)?.assetCount,
        publishedVideoCount: countsByClientId.get(client.id)?.publishedVideoCount,
      }));

      setClients(clientsWithCounts);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchClients();
    },
  });

  useEffect(() => {
    fetchClients();
  }, [user]);

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const readinessOrder = { NOT_STARTED: 0, IN_PROGRESS: 1, COMPLETE: 2 } as const;

    const matchesQuery = (client: Client) => {
      if (!query) return true;
      const name = client.name?.toLowerCase() || "";
      const company = client.company?.toLowerCase() || "";
      return name.includes(query) || company.includes(query);
    };

    const matchesReadiness = (client: Client) => {
      if (readinessFilter === "all") return true;
      return getReadinessSignals(client).status === readinessFilter;
    };

    const sorted = [...clients]
      .filter(matchesQuery)
      .filter(matchesReadiness)
      .sort((a, b) => {
        const readinessA = getReadinessSignals(a);
        const readinessB = getReadinessSignals(b);
        const readinessDiff = readinessOrder[readinessA.status] - readinessOrder[readinessB.status];
        if (readinessDiff !== 0) return readinessDiff;

        if (sortMode === "strategy") {
          const publishedA = a.publishedVideoCount ?? 0;
          const publishedB = b.publishedVideoCount ?? 0;
          if (publishedA !== publishedB) return publishedA - publishedB;
          const assetsA = a.assetCount ?? 0;
          const assetsB = b.assetCount ?? 0;
          if (assetsA !== assetsB) return assetsA - assetsB;
        }

        const labelA = (a.name || a.company || "").toLowerCase();
        const labelB = (b.name || b.company || "").toLowerCase();
        return labelA.localeCompare(labelB);
      });

    return sorted;
  }, [clients, readinessFilter, searchQuery, sortMode]);

  const handleCreateClient = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Client name is required",
        variant: "destructive",
      });
      return;
    }
    if (!formData.company.trim()) {
      toast({
        title: "Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const newClient = await createClientForMyAgency({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        company: formData.company.trim(),
      });

      toast({
        title: "Success",
        description: "Client created successfully",
      });

      setShowDialog(false);
      setFormData({ name: "", email: "", phone: "", company: "", status: "active", onboardingMode: "agency" });

      if (formData.onboardingMode === "agency") {
        navigate(`/onboarding/client/${newClient.id}`);
      } else {
        navigate(`/clients/${newClient.id}?tab=portal`);
      }
    } catch (error: any) {
      console.error("Error creating client:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="space-y-4 md:space-y-6"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div className="flex justify-center">
          <div
            className={`text-sm text-muted-foreground transition-opacity ${pullDistance > 60 ? "opacity-100" : "opacity-50"}`}
          >
            {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Agency Client Control Panel</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Decide who needs strategy next in under 10 seconds.
          </p>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search by client or company"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={readinessFilter} onValueChange={setReadinessFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Readiness" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Readiness: All</SelectItem>
                <SelectItem value="NOT_STARTED">NOT_STARTED</SelectItem>
                <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                <SelectItem value="COMPLETE">COMPLETE</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={setSortMode}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="readiness">Sort: Readiness then Name</SelectItem>
                <SelectItem value="strategy">Sort: Most needing strategy</SelectItem>
              </SelectContent>
            </Select>
            {canManageClients && (
              <PlanGuard feature="clients" requiredPlan="starter">
                <Button
                  onClick={() => {
                    hapticButton();
                    isAtLimit ? openUpgradeModal({ feature: "More clients" }) : setShowDialog(true);
                  }}
                  className="w-full sm:w-auto"
                  style={{ minHeight: isMobile ? "44px" : undefined }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </PlanGuard>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Prompt - Client Limit Reached */}
      {isAtLimit && (
        <Card className="border-primary bg-primary/5 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">You've reached your client limit</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upgrade your plan to manage more clients and scale your agency.
                </p>
                <Button onClick={() => openUpgradeModal({ feature: "More clients" })} size="sm">
                  Upgrade Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Add your first client</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start capturing strategy context and unlock AI-driven delivery.
            </p>
            {canManageClients && (
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clients match filters</h3>
            <p className="text-sm text-muted-foreground mb-4">Try clearing search or readiness filters.</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setReadinessFilter("all");
              }}
            >
              Reset filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const readiness = getReadinessSignals(client);
            const strategyHint = getStrategyHint(readiness);
            const nextStep = getNextStep(readiness);
            const assetCountLabel = countsAvailable ? client.assetCount ?? 0 : "G��";
            const publishedLabel = countsAvailable ? client.publishedVideoCount ?? 0 : "G��";

            return (
              <Card key={client.id} className="border-border/70 bg-card/50">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-semibold text-base">{client.name}</div>
                          {client.company && (
                            <div className="text-xs text-muted-foreground">{client.company}</div>
                          )}
                        </div>
                        <Badge variant={getReadinessVariant(readiness.status)}>
                          {readiness.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{strategyHint}</div>
                      <div className="text-xs text-muted-foreground">{nextStep}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>{assetCountLabel} assets</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Video className="h-4 w-4" />
                        <span>{publishedLabel} published</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/clients/${client.id}`)}>
                        Open Workspace
                      </Button>
                      <Button size="sm" onClick={() => navigate(`/clients/${client.id}?tab=strategy&action=strategy`)}>
                        Run Strategy
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Client Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className={isMobile ? "max-h-[85vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Create a new client workspace for your agency</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm">
                Client Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter client name"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@example.com"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm">
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="company" className="text-sm">
                Company *
              </Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Company name"
                style={{ minHeight: isMobile ? "44px" : undefined }}
                className="touch-manipulation"
              />
            </div>
            <div>
              <Label htmlFor="onboardingMode" className="text-sm">
                Onboarding Owner
              </Label>
              <Select
                value={formData.onboardingMode}
                onValueChange={(value) => setFormData({ ...formData, onboardingMode: value })}
              >
                <SelectTrigger style={{ minHeight: isMobile ? "44px" : undefined }} className="touch-manipulation">
                  <SelectValue placeholder="Select onboarding owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency completes onboarding</SelectItem>
                  <SelectItem value="client">Let client complete onboarding</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                If the client completes onboarding, you will be redirected to the client portal tab to enable access.
              </p>
            </div>
            <div>
              <Label htmlFor="status" className="text-sm">
                Status
              </Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger style={{ minHeight: isMobile ? "44px" : undefined }} className="touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                hapticButton();
                setShowDialog(false);
              }}
              disabled={submitting}
              style={{ minHeight: isMobile ? "44px" : undefined }}
              className="touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                hapticButton();
                handleCreateClient();
              }}
              disabled={submitting}
              style={{ minHeight: isMobile ? "44px" : undefined }}
              className="touch-manipulation"
            >
              {submitting ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
