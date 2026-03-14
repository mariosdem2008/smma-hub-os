import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useClientFonts } from "@/hooks/useClientFonts";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useAgencyMemberOptions, useClientEnrichmentQueue, useClientExecutionTasks, useClientOperationEvents, useClientOperationsChecklist, useClientOperationsSetup } from "@/hooks/useClientOperations";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { hapticSelection } from "@/lib/haptics";
import { buildOperationsChecklist } from "@/lib/onboarding/operationsChecklist";
import {
  buildWorkspaceStatusBadge,
  formatOnboardingFieldLabel,
  getOpenItemCount,
  type StagedReadinessSnapshot,
} from "@/lib/onboarding/stagedReadiness";
import {
  getClientBrainStatus,
  getClientById,
  getClientBrandingPrimaryColor,
  getMissingFieldMeta,
  normalizeMissingFieldKey,
} from "@/data";
import { isPermissionError } from "@/data/supabase";
import ClientHeader from "@/components/ClientHeader";
import OverviewTab from "@/components/client-tabs/OverviewTab";
import AnalyticsTab from "@/components/client-tabs/AnalyticsTab";
import BrandIdentityTab from "@/components/client-tabs/BrandIdentityTab";
import SocialProfilesTab from "@/components/SocialProfilesTab";
import PipelineTab from "@/components/client-tabs/PipelineTab";
import CalendarTab from "@/components/client-tabs/CalendarTab";
import ClientUploadsTab from "@/components/client-tabs/ClientUploadsTab";
import { ClientPortalTab } from "@/components/client-tabs/ClientPortalTab";
import LibraryTab from "@/components/client-tabs/LibraryTab";
import TasksTab from "@/components/client-tabs/TasksTab";
import ReportsTab from "@/components/client-tabs/ReportsTab";
import AdsTab from "@/components/client-tabs/AdsTab";
import StrategyHubTab from "@/components/client-tabs/StrategyHubTab";
import IdeaScriptingTab from "@/components/client-tabs/IdeaScriptingTab";
import { ClientRightPanel, ClientRightPanelTrigger } from "@/components/client-detail/ClientRightPanel";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/lib/featureFlags";
import {
  LayoutDashboard,
  BarChart3,
  Megaphone,
  FileText,
  Palette,
  Workflow,
  Calendar as CalendarIcon,
  FolderOpen,
  CheckSquare,
  Share2,
  Upload,
  Users,
  Lightbulb,
  MoreHorizontal,
  ChevronDown,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Wrench,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  logo_url: string | null;
  niche: string | null;
  website: string | null;
  brand_colors: string[] | null;
  tone_of_voice: string | null;
  notes: string | null;
  primary_font: string | null;
  secondary_font: string | null;
  agency_id: string;
}

const primaryTabs = [
  { id: "strategy", label: "Strategy", icon: Lightbulb },
  { id: "pipeline", label: "Pipeline", icon: Workflow },
  { id: "idea-scripting", label: "Idea/Scripting", icon: FileText },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "library", label: "Library", icon: FolderOpen },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "portal", label: "Approvals & Access", icon: Users },
];

const secondaryTabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ads", label: "Ads", icon: Megaphone },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "brand", label: "Brand Identity", icon: Palette },
  { id: "social", label: "Social Profiles", icon: Share2 },
  { id: "uploads", label: "Client Submissions", icon: Upload },
];

const allTabs = [...primaryTabs, ...secondaryTabs];

export default function ClientDetail() {
  const { clientId: rawClientId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  // FIX: Clean the client ID by removing query parameters
  const clientId = rawClientId?.split("?")[0] || "";
  const [client, setClient] = useState<Client | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateLoading, setGateLoading] = useState(true);
  const [gateStatus, setGateStatus] = useState<{
    usable: boolean;
    missingFields?: string[];
    missingFieldsCount?: number;
  } | null>(null);
  const [gateNoAccess, setGateNoAccess] = useState(false);
  const [activeTab, setActiveTab] = useState("strategy");
  const [agencyId, setAgencyId] = useState<string>("");
  const lastFocusRef = useRef<string | null>(null);
  const lastActionRef = useRef<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const { data: onboardingProfile } = useOnboardingProfile(clientId || undefined);
  const { data: operationsSetupRecord } = useClientOperationsSetup(clientId || undefined);
  const { data: operationsChecklistItems = [] } = useClientOperationsChecklist(clientId || undefined);
  const { data: executionTasks = [] } = useClientExecutionTasks(clientId || undefined);
  const { data: operationEvents = [] } = useClientOperationEvents(clientId || undefined);
  const { data: enrichmentQueue = [] } = useClientEnrichmentQueue(clientId || undefined);
  const { data: agencyMembers = [] } = useAgencyMemberOptions(agencyId || undefined);

  // Tab notification badges (behind feature flag)
  const [tabBadgeCounts, setTabBadgeCounts] = useState<Record<string, number>>({});
  const showTabBadges = isFeatureEnabled("CLIENTDETAIL_TAB_BADGES");
  const showRightPanel = isFeatureEnabled("CLIENTDETAIL_RIGHT_PANEL");

  // Pull-to-refresh for mobile
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchClient();
    },
  });

  const fetchClient = async () => {
    if (!clientId) return;

    try {
      const data = await getClientById(clientId);
      setClient({
        ...data,
        status: data.status || "active",
        updated_at: data.updated_at,
        brand_colors: Array.isArray(data.brand_colors) ? (data.brand_colors as string[]) : null,
      });
      setAgencyId(data.agency_id);

      // Fetch branding primary color
      const color = await getClientBrandingPrimaryColor(clientId);
      setPrimaryColor(color);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch client details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGateStatus = async () => {
    if (!clientId) {
      setGateStatus({ usable: false });
      setGateLoading(false);
      return;
    }

    try {
      const status = await getClientBrainStatus(clientId);
      setGateStatus(status);
      setGateNoAccess(false);
    } catch (error: any) {
      if (isPermissionError(error)) {
        setGateNoAccess(true);
        setGateStatus({ usable: false });
        setGateLoading(false);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to check client onboarding status",
        variant: "destructive",
      });
      setGateStatus({ usable: false });
    } finally {
      setGateLoading(false);
    }
  };

  // Add this function to handle client updates
  const handleClientUpdate = async () => {
    await fetchClient();
  };

  // Load client fonts dynamically
  useClientFonts({
    primaryFont: client?.primary_font,
    secondaryFont: client?.secondary_font,
  });

  // Handle URL-based tab navigation
  useEffect(() => {
    const tab = searchParams.get("tab");
    const normalizedTab = tab === "planning" ? "strategy" : tab;
    if (normalizedTab && allTabs.some((t) => t.id === normalizedTab)) {
      setActiveTab(normalizedTab);
    }
    if (tab === "planning") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "strategy");
      setSearchParams(nextParams);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const focus = searchParams.get("focus");
    const action = searchParams.get("action");

    if (focus && focus !== lastFocusRef.current) {
      toast({
        title: "Focused view",
        description: `Focused: ${focus}.`,
      });
      lastFocusRef.current = focus;
    }

    if (action && action !== lastActionRef.current) {
      toast({
        title: "AI action queued",
        description: `AI action queued: ${action}.`,
      });
      lastActionRef.current = action;
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  useEffect(() => {
    fetchGateStatus();
  }, [clientId]);

  const handleNotesUpdate = (notes: string) => {
    if (client) {
      setClient({ ...client, notes });
    }
  };

  const getStepIdFromHref = (href: string | null | undefined) => {
    if (!href) return null;
    const [prefix, value] = href.split(":");
    if (prefix === "onboarding") return value || null;
    return null;
  };

  const handleTabChange = (tabId: string) => {
    const nextTab = tabId === "planning" ? "strategy" : tabId;
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams);
    hapticSelection();
  };

  const focusParam = searchParams.get("focus");
  const actionParam = searchParams.get("action");
  const handoffParam = searchParams.get("handoff");
  const strategyGenerating = handoffParam === "strategy_generating";
  const stagedReadiness = ((onboardingProfile?.v5_meta as Record<string, unknown> | null)?.staged_readiness ?? null) as StagedReadinessSnapshot | null;
  const opsMissing = stagedReadiness?.operations_setup?.missing ?? [];
  const enrichmentMissing = stagedReadiness?.progressive_enrichment?.missing ?? [];
  const operationsChecklist = buildOperationsChecklist(onboardingProfile ?? null);
  const blockingChecklistItems = operationsChecklist.sections.flatMap((section) => section.items).filter((item) => item.status === "blocked");
  const activeExecutionTasks = executionTasks.filter((task) => ["todo", "waiting_on_client", "in_progress", "blocked"].includes(task.status));
  const urgentExecutionTasks = activeExecutionTasks.filter((task) => task.priority === "urgent");
  const recentOperationEvents = operationEvents.slice(0, 3);
  const assigneeLabelByUserId = new Map(
    agencyMembers.map((member) => [member.user_id, member.profile?.full_name || member.profile?.email || member.user_id]),
  );
  const aiStatus = !gateStatus?.usable
    ? { label: "Initial setup required", tone: "warning" as const, detail: "Complete onboarding to unlock strategy and execution workflows." }
    : buildWorkspaceStatusBadge({ stagedReadiness, strategyGenerating, showRightPanel });

  if (loading || gateLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Client not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gateNoAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              You do not have access to this client&apos;s AI onboarding status.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gateStatus?.usable) {
    const returnTo = `${location.pathname}${location.search}`;
    // Client onboarding URL
    const onboardingUrl = `/onboarding/client/${clientId}`;
    const missingFields = gateStatus?.missingFields ?? [];
    const missingFieldItems = (() => {
      const seen = new Set<string>();
      return missingFields
        .map((field) => {
          const canonicalKey = normalizeMissingFieldKey(field);
          if (!canonicalKey || seen.has(canonicalKey)) return null;
          seen.add(canonicalKey);

          const meta =
            getMissingFieldMeta(field) ??
            (canonicalKey
              ? getMissingFieldMeta(canonicalKey)
              : undefined) ?? {
              label: canonicalKey
                ? canonicalKey.replace(/[_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : "Required information",
              reason: "Complete this step to unlock strategy and content tools.",
              ctaLabel: "Fix now",
              href: "onboarding:start",
            };
          return { field, meta, canonicalKey };
        })
        .filter(Boolean) as Array<{ field: string; canonicalKey: string; meta: { label: string; reason: string; ctaLabel: string; href: string } }>;
    })();
    const missingCount = missingFieldItems.length;

    const buildOnboardingHref = (href: string) => {
      const stepId = getStepIdFromHref(href);
      const params = new URLSearchParams();
      if (returnTo) params.set("returnTo", returnTo);
      if (stepId && stepId !== "start") {
        params.set("step", stepId);
      }
      const query = params.toString();
      return query ? `/onboarding/client/${clientId}?${query}` : `/onboarding/client/${clientId}`;
    };

    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-5 py-10 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Client Setup Incomplete</h1>
              <p className="text-sm text-muted-foreground">
                Complete the onboarding workflow to unlock strategy generation, planning, and AI-assisted execution for this client.
              </p>
              {typeof missingCount === "number" && (
                <p className="text-xs text-muted-foreground">
                  Open requirements: {missingCount}
                </p>
              )}
            </div>
            {missingFieldItems.length > 0 && (
              <div className="space-y-2 text-left">
                {missingFieldItems.map((item) => (
                  <div
                    key={`missing-${item.field}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {item.meta.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.meta.reason}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => navigate(buildOnboardingHref(item.meta.href))}
                    >
                      {item.meta.ctaLabel || "Fix now"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                onClick={() =>
                  navigate(
                    `/onboarding/client/${clientId}?returnTo=${encodeURIComponent(returnTo)}`,
                  )
                }
              >
                Continue Setup
              </Button>
              {client.email && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const link = `${window.location.origin}${onboardingUrl}?returnTo=${encodeURIComponent(returnTo)}`;
                    window.location.href = `mailto:${client.email}?subject=Complete AI onboarding&body=${encodeURIComponent(
                      `Please complete your client setup here: ${link}`,
                    )}`;
                  }}
                >
                  Request Client Input
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "strategy":
      case "planning":
        return (
          <StrategyHubTab
            clientId={clientId}
            agencyId={agencyId}
          />
        );
      case "overview":
        return <OverviewTab clientId={clientId} client={client} onNotesUpdate={handleNotesUpdate} />;
      case "analytics":
        return <AnalyticsTab clientId={clientId} />;
      case "ads":
        return <AdsTab clientId={clientId} agencyId={agencyId} />;
      case "reports":
        return <ReportsTab clientId={clientId} agencyId={agencyId} />;
      case "brand":
        return <BrandIdentityTab clientId={clientId} clientName={client.name} />;
      case "social":
        return <SocialProfilesTab clientId={clientId} />;
      case "pipeline":
        return <PipelineTab clientId={clientId} agencyId={agencyId} />;
      case "idea-scripting":
        return <IdeaScriptingTab clientId={clientId} />;
      case "calendar":
        return <CalendarTab clientId={clientId} />;
      case "library":
        return <LibraryTab clientId={clientId} agencyId={agencyId} />;
      case "uploads":
        return <ClientUploadsTab clientId={clientId} agencyId={agencyId} />;
      case "tasks":
        return <TasksTab clientId={clientId} agencyId={agencyId} />;
      case "portal":
        return <ClientPortalTab clientId={clientId} />;
      default:
        return <OverviewTab clientId={clientId} client={client} onNotesUpdate={handleNotesUpdate} />;
    }
  };

  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)]"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div className="absolute top-0 left-0 right-0 flex justify-center z-50">
          <div
            className={`text-sm text-muted-foreground transition-opacity ${pullDistance > 60 ? "opacity-100" : "opacity-50"}`}
          >
            {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}

      {/* Left Sidebar Navigation */}
      {!isMobile && (
        <aside className="w-56 border-r bg-muted/30 flex-shrink-0">
          <div className="p-4 border-b space-y-3">
            <button
              onClick={() => navigate("/clients")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              <span>Clients</span>
            </button>
            <ClientHeader
              clientId={clientId}
              name={client.name}
              logoUrl={client.logo_url}
              niche={client.niche}
              website={client.website}
              primaryColor={primaryColor}
              status={client.status}
              updatedAt={client.updated_at}
              compact
              onClientUpdate={handleClientUpdate}
            />
          </div>
          <nav className="p-2 space-y-1">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badgeCount = showTabBadges ? tabBadgeCounts[tab.id] ?? 0 : 0;

              return (
                <div key={tab.id}>
                  <button
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate flex-1">{tab.label}</span>
                    {badgeCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold"
                      >
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </Badge>
                    )}
                  </button>
                </div>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                    secondaryTabs.some((tab) => tab.id === activeTab)
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <MoreHorizontal className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">More</span>
                  <ChevronDown className="ml-auto h-4 w-4 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {secondaryTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <DropdownMenuItem key={tab.id} onClick={() => handleTabChange(tab.id)}>
                      <Icon className="mr-2 h-4 w-4" />
                      {tab.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <div className="px-3 pb-3">
            <div
              className={cn(
                "rounded-md border px-2.5 py-2 text-xs",
                aiStatus.tone === "ready" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                aiStatus.tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-100",
                aiStatus.tone === "degraded" && "border-orange-500/30 bg-orange-500/10 text-orange-100",
              )}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {aiStatus.tone === "ready" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : aiStatus.tone === "warning" ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <Wrench className="h-3.5 w-3.5" />
                )}
                <span>{aiStatus.label}</span>
              </div>
              <div className="mt-1 opacity-90">{aiStatus.detail}</div>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Tab Bar */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
          <div className="flex overflow-x-auto scrollbar-hide py-2 px-2 gap-1">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const badgeCount = showTabBadges ? tabBadgeCounts[tab.id] ?? 0 : 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 min-w-[60px]",
                    activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <div className="relative">
                    <Icon className="h-4 w-4" />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className="truncate max-w-[60px]">{tab.label}</span>
                </button>
              );
            })}
            <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 min-w-[60px]",
                    secondaryTabs.some((tab) => tab.id === activeTab)
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="truncate max-w-[60px]">More</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl">
                <SheetHeader>
                  <SheetTitle>More tabs</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid gap-2">
                  {secondaryTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <Button
                        key={tab.id}
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => {
                          handleTabChange(tab.id);
                          setMobileMoreOpen(false);
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </Button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 overflow-auto", isMobile ? "pb-24 p-4" : "p-6")}>
        {/* Show client header on mobile */}
        {isMobile && (
          <div className="mb-4 space-y-3">
            <button
              onClick={() => navigate("/clients")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              <span>Clients</span>
            </button>
            <ClientHeader
              clientId={clientId}
              name={client.name}
              logoUrl={client.logo_url}
              niche={client.niche}
              website={client.website}
              primaryColor={primaryColor}
              status={client.status}
              updatedAt={client.updated_at}
              onClientUpdate={handleClientUpdate}
            />
          </div>
        )}

        {(focusParam || actionParam) && (
          <div className="mb-4 rounded-lg border border-border/70 bg-card/40 p-3 text-sm">
            {focusParam && <div className="text-muted-foreground">Focused: {focusParam}</div>}
            {actionParam && <div className="text-muted-foreground">AI action queued: {actionParam}</div>}
          </div>
        )}

        {strategyGenerating && (
          <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
            Strategy generation is in progress. You can stay here while the system finishes building the first strategy document.
          </div>
        )}

        {gateStatus?.usable && stagedReadiness && (
          <div className="mb-4 rounded-lg border border-border/70 bg-card/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Client setup journey</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {stagedReadiness.state === "setup_usable" &&
                    "Essential intake is complete. Finish operations setup before the team treats this client as execution-ready."}
                  {stagedReadiness.state === "execution_ready" &&
                    "Operations setup is complete. Use enrichment to strengthen strategy quality and AI output."}
                  {stagedReadiness.state === "strategy_enriched" &&
                    "Setup, execution readiness, and strategy context are aligned."}
                </div>
              </div>
              <div className="grid min-w-[220px] gap-2 text-xs sm:grid-cols-3 sm:text-right">
                <div>
                  <div className="font-medium text-foreground">{stagedReadiness.essential_intake?.percent ?? 0}%</div>
                  <div className="text-muted-foreground">Essential intake</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{stagedReadiness.operations_setup?.percent ?? 0}%</div>
                  <div className="text-muted-foreground">Operations setup</div>
                </div>
                <div>
                  <div className="font-medium text-foreground">{stagedReadiness.progressive_enrichment?.percent ?? 0}%</div>
                  <div className="text-muted-foreground">Profile enrichment</div>
                </div>
              </div>
            </div>

            {(operationsSetupRecord?.setup_status || enrichmentQueue.length > 0 || activeExecutionTasks.length > 0) && (
              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                {operationsSetupRecord?.setup_status && (
                  <Badge variant="outline">
                    Ops record: {operationsSetupRecord.setup_status.replace(/_/g, " ")}
                  </Badge>
                )}
                {operationsChecklistItems.length > 0 && (
                  <Badge variant="outline">
                    Checklist: {operationsChecklistItems.filter((item) => item.status === "done").length}/{operationsChecklistItems.length}
                  </Badge>
                )}
                {enrichmentQueue.length > 0 && (
                  <Badge variant="outline">
                    Enrichment queue: {enrichmentQueue.length} active
                  </Badge>
                )}
                {activeExecutionTasks.length > 0 && (
                  <Badge variant="outline">
                    Execution tasks: {activeExecutionTasks.length} active
                  </Badge>
                )}
                {urgentExecutionTasks.length > 0 && (
                  <Badge variant="destructive">
                    {urgentExecutionTasks.length} urgent
                  </Badge>
                )}
              </div>
            )}

            {(getOpenItemCount(opsMissing) > 0 || getOpenItemCount(enrichmentMissing) > 0) && (
              <div className="mt-4 grid gap-3 xl:grid-cols-[1.3fr_1fr]">
                {getOpenItemCount(opsMissing) > 0 && (
                  <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                    <div className="text-sm font-medium text-foreground">Still blocking execution</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {opsMissing.map((field) => (
                        <Badge key={`ops-${field}`} variant="secondary">
                          {formatOnboardingFieldLabel(field)}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/onboarding/client/${clientId}?stage=operations_setup&returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`)}
                      >
                        Finish operations setup
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Execution checklist</div>
                      <div className="text-xs text-muted-foreground">
                        {operationsChecklist.summary.complete}/{operationsChecklist.summary.total} items covered
                      </div>
                    </div>
                    {blockingChecklistItems.length > 0 && (
                      <Badge variant="outline">{blockingChecklistItems.length} blocker{blockingChecklistItems.length === 1 ? "" : "s"}</Badge>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {blockingChecklistItems.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-foreground">{item.title}</div>
                          <Badge variant="secondary">{item.owner}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.nextAction}</div>
                      </div>
                    ))}
                    {blockingChecklistItems.length === 0 && (
                      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                        No blocking execution items remain.
                      </div>
                    )}
                  </div>
                </div>

                {activeExecutionTasks.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">Active execution tasks</div>
                        <div className="text-xs text-muted-foreground">
                          Combined work from setup blockers and enrichment signals
                        </div>
                      </div>
                      {urgentExecutionTasks.length > 0 && (
                        <Badge variant="destructive">{urgentExecutionTasks.length} urgent</Badge>
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      {activeExecutionTasks.slice(0, 4).map((task) => (
                        <div key={task.id} className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-foreground">{task.title}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant={task.priority === "urgent" ? "destructive" : "secondary"}>
                                {task.priority}
                              </Badge>
                              <Badge variant="outline">{task.owner}</Badge>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {task.description || task.source_kind.replace(/_/g, " ")}
                          </div>
                          {(task.assignee_user_id || task.resolution_note) && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {task.assignee_user_id ? `Assigned to ${assigneeLabelByUserId.get(task.assignee_user_id) || task.assignee_user_id}` : "No assignee"}
                              {task.resolution_note ? ` • Note: ${task.resolution_note}` : ""}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recentOperationEvents.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">Recent operational activity</div>
                        <div className="text-xs text-muted-foreground">
                          Latest drift, queue, and task lifecycle updates
                        </div>
                      </div>
                      <Badge variant="outline">{recentOperationEvents.length} recent</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {recentOperationEvents.map((event) => (
                        <div key={event.id} className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-foreground">{event.event_kind.replace(/_/g, " ")}</div>
                            <Badge variant="outline">{event.actor_kind}</Badge>
                          </div>
                          {typeof event.payload?.title === "string" && (
                            <div className="mt-1 text-xs text-muted-foreground">{String(event.payload.title)}</div>
                          )}
                          {(typeof event.payload?.next_assignee_user_id === "string" ||
                            typeof event.payload?.previous_assignee_user_id === "string") && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Assignee:{" "}
                              {typeof event.payload?.previous_assignee_user_id === "string"
                                ? assigneeLabelByUserId.get(String(event.payload.previous_assignee_user_id)) ||
                                  String(event.payload.previous_assignee_user_id)
                                : "Unassigned"}{" "}
                              to{" "}
                              {typeof event.payload?.next_assignee_user_id === "string"
                                ? assigneeLabelByUserId.get(String(event.payload.next_assignee_user_id)) ||
                                  String(event.payload.next_assignee_user_id)
                                : "Unassigned"}
                            </div>
                          )}
                          {typeof event.payload?.resolution_note === "string" && String(event.payload.resolution_note).trim().length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">Note: {String(event.payload.resolution_note)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {getOpenItemCount(enrichmentMissing) > 0 && (
                  <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                    <div className="text-sm font-medium text-foreground">Recommended profile improvements</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {enrichmentMissing.map((field) => (
                        <Badge key={`enrichment-${field}`} variant="secondary">
                          {formatOnboardingFieldLabel(field)}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/onboarding/client/${clientId}?stage=progressive_enrichment&returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`)}
                      >
                        Improve client profile
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "mb-4 rounded-lg border px-3 py-2 text-xs sm:text-sm",
            aiStatus.tone === "ready" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
            aiStatus.tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-100",
            aiStatus.tone === "degraded" && "border-orange-500/30 bg-orange-500/10 text-orange-100",
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            {aiStatus.tone === "ready" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : aiStatus.tone === "warning" ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Wrench className="h-4 w-4" />
            )}
            <span>{aiStatus.label}</span>
          </div>
          <div className="mt-0.5 opacity-90">{aiStatus.detail}</div>
        </div>

        <div className="space-y-4">{renderTabContent()}</div>
      </main>

      {/* Global Right Panel Trigger - Hidden when feature flag is OFF */}
      {showRightPanel && (
        <ClientRightPanelTrigger onClick={() => setRightPanelOpen(true)} />
      )}

      {/* Global Right Panel (AI Chat, Decisions, History, Tasks) - Hidden when feature flag is OFF */}
      {showRightPanel && rightPanelOpen && (
        <ClientRightPanel
          open={rightPanelOpen}
          onOpenChange={setRightPanelOpen}
          clientId={clientId}
        />
      )}
    </div>
  );
}
