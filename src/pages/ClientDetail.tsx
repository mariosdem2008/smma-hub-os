import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { hapticSelection } from "@/lib/haptics";
import { getClientBrainStatus, getClientById, getClientBrandingPrimaryColor } from "@/data";
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
import { cn } from "@/lib/utils";
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
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  created_at: string;
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
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "library", label: "Library", icon: FolderOpen },
  { id: "portal", label: "Portal", icon: Users },
];

const secondaryTabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ads", label: "Ads", icon: Megaphone },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "brand", label: "Brand Identity", icon: Palette },
  { id: "social", label: "Social Profiles", icon: Share2 },
  { id: "uploads", label: "Client Uploads", icon: Upload },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
];

const allTabs = [...primaryTabs, ...secondaryTabs];

export default function ClientDetail() {
  const { clientId: rawClientId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [client, setClient] = useState<Client | null>(null);
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateLoading, setGateLoading] = useState(true);
  const [gateStatus, setGateStatus] = useState<{ usable: boolean; missingFields?: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState("strategy");
  const [agencyId, setAgencyId] = useState<string>("");
  const lastFocusRef = useRef<string | null>(null);
  const lastActionRef = useRef<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // FIX: Clean the client ID by removing query parameters
  const clientId = rawClientId?.split("?")[0] || "";

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
    } catch (error: any) {
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

  if (!gateStatus?.usable) {
    const returnTo = `${location.pathname}${location.search}`;
    const missingCount = gateStatus?.missingFields?.length;
    const onboardingUrl = `/onboarding/ai/client/${clientId}`;

    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-5 py-10 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">AI Client Onboarding required</h1>
              <p className="text-sm text-muted-foreground">
                Complete AI onboarding before accessing the client workspace.
              </p>
              {typeof missingCount === "number" && (
                <p className="text-xs text-muted-foreground">
                  Missing fields: {missingCount}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                onClick={() =>
                  navigate(
                    `/onboarding/ai/client/${clientId}?returnTo=${encodeURIComponent(returnTo)}`,
                  )
                }
              >
                Start AI Client Onboarding
              </Button>
              {client.email && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const link = `${window.location.origin}${onboardingUrl}?returnTo=${encodeURIComponent(returnTo)}`;
                    window.location.href = `mailto:${client.email}?subject=Complete AI onboarding&body=${encodeURIComponent(
                      `Please complete AI onboarding here: ${link}`,
                    )}`;
                  }}
                >
                  Send to client
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
        return <StrategyHubTab clientId={clientId} agencyId={agencyId} client={client} />;
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
          <div className="p-4 border-b">
            <ClientHeader
              clientId={clientId}
              name={client.name}
              logoUrl={client.logo_url}
              niche={client.niche}
              website={client.website}
              primaryColor={primaryColor}
              compact
              onClientUpdate={handleClientUpdate}
            />
          </div>
          <nav className="p-2 space-y-2">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
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
        </aside>
      )}

      {/* Mobile Tab Bar */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
          <div className="flex overflow-x-auto scrollbar-hide py-2 px-2 gap-1">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 min-w-[60px]",
                    activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
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
          <div className="mb-4">
            <ClientHeader
              clientId={clientId}
              name={client.name}
              logoUrl={client.logo_url}
              niche={client.niche}
              website={client.website}
              primaryColor={primaryColor}
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

        <div className="space-y-4">{renderTabContent()}</div>
      </main>
    </div>
  );
}
