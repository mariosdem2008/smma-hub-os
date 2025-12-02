import { useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
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
import ContentLibraryTab from "@/components/client-tabs/ContentLibraryTab";
import PipelineTab from "@/components/client-tabs/PipelineTab";
import CalendarTab from "@/components/client-tabs/CalendarTab";
import ClientUploadsTab from "@/components/client-tabs/ClientUploadsTab";
import WorkspaceTab from "@/components/client-tabs/WorkspaceTab";
import { ClientPortalTab } from "@/components/client-tabs/ClientPortalTab";
import LibraryTab from "@/components/client-tabs/LibraryTab";
import TasksTab from "@/components/client-tabs/TasksTab";
import ReportsTab from "@/components/client-tabs/ReportsTab";
import { useEffect } from "react";

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
  const tabsRef = useRef<HTMLDivElement>(null);

  // Pull-to-refresh for mobile
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchClient();
    },
  });

  const fetchClient = async () => {
    if (!clientId) return;

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch client details",
        variant: "destructive",
      });
    } else {
      setClient({
        ...data,
        brand_colors: Array.isArray(data.brand_colors) 
          ? (data.brand_colors as string[]) 
          : null,
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
    if (tab) {
      setActiveTab(tab);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Link to="/clients">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Client not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="space-y-4 md:space-y-6 client-workspace"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div className="flex justify-center">
          <div className={`text-sm text-muted-foreground transition-opacity ${pullDistance > 60 ? "opacity-100" : "opacity-50"}`}>
            {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}

      <Link to="/clients">
        <Button 
          variant="ghost" 
          style={{ minHeight: isMobile ? "44px" : undefined }}
          className="touch-manipulation"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>
      </Link>

      <ClientHeader
        clientId={clientId!}
        name={client.name}
        logoUrl={client.logo_url}
        niche={client.niche}
        website={client.website}
        primaryColor={branding?.primary_color}
      />

      <Tabs 
        value={activeTab} 
        onValueChange={(value) => {
          setActiveTab(value);
          hapticSelection();
        }} 
        className="w-full"
      >
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:grid-cols-12 h-auto">
            <TabsTrigger value="overview" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Overview</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Analytics</TabsTrigger>
            <TabsTrigger value="reports" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Reports</TabsTrigger>
            <TabsTrigger value="brand" className="flex-shrink-0 min-h-[44px] px-3 md:px-4 whitespace-nowrap">Brand Identity</TabsTrigger>
            <TabsTrigger value="pipeline" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Pipeline</TabsTrigger>
            <TabsTrigger value="planning" className="flex-shrink-0 min-h-[44px] px-3 md:px-4 whitespace-nowrap">Content Planning</TabsTrigger>
            <TabsTrigger value="library" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Library</TabsTrigger>
            <TabsTrigger value="calendar" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Calendar</TabsTrigger>
            <TabsTrigger value="tasks" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Tasks</TabsTrigger>
            <TabsTrigger value="social" className="flex-shrink-0 min-h-[44px] px-3 md:px-4 whitespace-nowrap">Social Profiles</TabsTrigger>
            <TabsTrigger value="uploads" className="flex-shrink-0 min-h-[44px] px-3 md:px-4 whitespace-nowrap">Client Uploads</TabsTrigger>
            <TabsTrigger value="portal" className="flex-shrink-0 min-h-[44px] px-3 md:px-4 whitespace-nowrap">Client Portal</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab 
            clientId={clientId!} 
            client={client} 
            onNotesUpdate={handleNotesUpdate}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <ReportsTab clientId={clientId!} agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="brand" className="space-y-4">
          <BrandIdentityTab clientId={clientId!} clientName={client.name} />
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <SocialProfilesTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <ContentPlanningTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <PipelineTab clientId={clientId!} agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <CalendarTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <LibraryTab clientId={clientId!} agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="uploads" className="space-y-4">
          <ClientUploadsTab clientId={clientId!} agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <TasksTab clientId={clientId!} agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="portal" className="space-y-4">
          <ClientPortalTab clientId={clientId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
