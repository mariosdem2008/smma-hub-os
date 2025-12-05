import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom"; // Added Link import
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientFonts } from "@/hooks/useClientFonts";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { hapticSelection } from "@/lib/haptics";
import ClientHeader from "@/components/ClientHeader";
import OverviewTab from "@/components/client-tabs/OverviewTab";
import AnalyticsTab from "@/components/client-tabs/AnalyticsTab";
import BrandIdentityTab from "@/components/client-tabs/BrandIdentityTab";
import SocialProfilesTab from "@/components/SocialProfilesTab";
import ContentPlanningTab from "@/components/client-tabs/ContentPlanningTab";
import PipelineTab from "@/components/client-tabs/PipelineTab";
import CalendarTab from "@/components/client-tabs/CalendarTab";
import ClientUploadsTab from "@/components/client-tabs/ClientUploadsTab";
import { ClientPortalTab } from "@/components/client-tabs/ClientPortalTab";
import LibraryTab from "@/components/client-tabs/LibraryTab";
import TasksTab from "@/components/client-tabs/TasksTab";
import ReportsTab from "@/components/client-tabs/ReportsTab";
import AdsTab from "@/components/client-tabs/AdsTab";
import { useEffect } from "react";
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
}

interface ClientBranding {
  primary_color: string | null;
}

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ads", label: "Ads", icon: Megaphone },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "brand", label: "Brand Identity", icon: Palette },
  { id: "pipeline", label: "Pipeline", icon: Workflow },
  { id: "planning", label: "Content Planning", icon: Lightbulb },
  { id: "library", label: "Library", icon: FolderOpen },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "social", label: "Social Profiles", icon: Share2 },
  { id: "uploads", label: "Client Uploads", icon: Upload },
  { id: "portal", label: "Client Portal", icon: Users },
];

export default function ClientDetail() {
  const { clientId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [client, setClient] = useState<Client | null>(null);
  const [branding, setBranding] = useState<ClientBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [agencyId, setAgencyId] = useState<string>("");

  // Add debug logging
  useEffect(() => {
    console.log("ClientDetail mounted with clientId:", clientId);
  }, [clientId]);

  // Pull-to-refresh for mobile
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchClient();
    },
  });

  const fetchClient = async () => {
    if (!clientId) return;

    const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch client details",
        variant: "destructive",
      });
    } else {
      setClient({
        ...data,
        brand_colors: Array.isArray(data.brand_colors) ? (data.brand_colors as string[]) : null,
      });
      setAgencyId(data.agency_id);
    }

    // Fetch branding data
    const { data: brandingData } = await supabase
      .from("client_branding")
      .select("primary_color")
      .eq("client_id", clientId)
      .maybeSingle();

    if (brandingData) {
      setBranding(brandingData);
    }

    setLoading(false);
  };

  // Load client fonts dynamically
  useClientFonts({
    primaryFont: client?.primary_font,
    secondaryFont: client?.secondary_font,
  });

  // Handle URL-based tab navigation
  useEffect(() => {
    const tab = searchParams.get("tab");
    console.log("URL tab param changed to:", tab);

    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    } else if (!tab) {
      // Set default tab if none specified
      setSearchParams({ tab: "overview" }, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchClient();
  }, [clientId]);

  const handleNotesUpdate = (notes: string) => {
    if (client) {
      setClient({ ...client, notes });
    }
  };

  const handleTabChange = (tabId: string) => {
    console.log("Tab changed to:", tabId);
    setActiveTab(tabId);
    // Use replace to avoid adding to history stack
    setSearchParams({ tab: tabId }, { replace: true });
    hapticSelection();
  };

  if (loading) {
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

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab clientId={clientId!} client={client} onNotesUpdate={handleNotesUpdate} />;
      case "analytics":
        return <AnalyticsTab clientId={clientId!} />;
      case "ads":
        return <AdsTab clientId={clientId!} agencyId={agencyId} />;
      case "reports":
        return <ReportsTab clientId={clientId!} agencyId={agencyId} />;
      case "brand":
        return <BrandIdentityTab clientId={clientId!} clientName={client.name} />;
      case "social":
        return <SocialProfilesTab clientId={clientId!} />;
      case "planning":
        return <ContentPlanningTab clientId={clientId!} />;
      case "pipeline":
        return <PipelineTab clientId={clientId!} agencyId={agencyId} />;
      case "calendar":
        return <CalendarTab clientId={clientId!} />;
      case "library":
        return <LibraryTab clientId={clientId!} agencyId={agencyId} />;
      case "uploads":
        return <ClientUploadsTab clientId={clientId!} agencyId={agencyId} />;
      case "tasks":
        return <TasksTab clientId={clientId!} agencyId={agencyId} />;
      case "portal":
        return <ClientPortalTab clientId={clientId!} />;
      default:
        return <OverviewTab clientId={clientId!} client={client} onNotesUpdate={handleNotesUpdate} />;
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
              clientId={clientId!}
              name={client.name}
              logoUrl={client.logo_url}
              niche={client.niche}
              website={client.website}
              primaryColor={branding?.primary_color}
              compact
            />
          </div>
          <nav className="p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Add extra prevention
                    e.nativeEvent.stopImmediatePropagation?.();
                    handleTabChange(tab.id);
                    return false;
                  }}
                  type="button"
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
          </nav>
        </aside>
      )}

      {/* Mobile Tab Bar */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
          <div className="flex overflow-x-auto scrollbar-hide py-2 px-2 gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation?.();
                    handleTabChange(tab.id);
                    return false;
                  }}
                  type="button"
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0 min-w-[60px]",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate max-w-[60px]">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 overflow-auto", isMobile ? "pb-24 p-4" : "p-6")}>
        {/* Show client header on mobile */}
        {isMobile && (
          <div className="mb-4">
            <ClientHeader
              clientId={clientId!}
              name={client.name}
              logoUrl={client.logo_url}
              niche={client.niche}
              website={client.website}
              primaryColor={branding?.primary_color}
            />
          </div>
        )}

        <div className="space-y-4">{renderTabContent()}</div>
      </main>
    </div>
  );
}
