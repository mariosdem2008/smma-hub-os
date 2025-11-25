import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useClientFonts } from "@/hooks/useClientFonts";
import ClientHeader from "@/components/ClientHeader";
import OverviewTab from "@/components/client-tabs/OverviewTab";
import BrandIdentityTab from "@/components/client-tabs/BrandIdentityTab";
import SocialProfilesTab from "@/components/SocialProfilesTab";
import ContentPlanningTab from "@/components/client-tabs/ContentPlanningTab";
import ContentLibraryTab from "@/components/client-tabs/ContentLibraryTab";
import PipelineTab from "@/components/client-tabs/PipelineTab";
import CalendarTab from "@/components/client-tabs/CalendarTab";
import ClientUploadsTab from "@/components/client-tabs/ClientUploadsTab";
import WorkspaceTab from "@/components/client-tabs/WorkspaceTab";
import { ClientPortalTab } from "@/components/client-tabs/ClientPortalTab";
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
  const [client, setClient] = useState<Client | null>(null);
  const [branding, setBranding] = useState<ClientBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [agencyId, setAgencyId] = useState<string>("");

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

    fetchClient();
  }, [clientId, toast]);

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
    <div className="space-y-6 client-workspace">
      <Link to="/clients">
        <Button variant="ghost">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:grid-cols-9">
            <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="pipeline" className="flex-shrink-0">Pipeline</TabsTrigger>
            <TabsTrigger value="calendar" className="flex-shrink-0">Calendar</TabsTrigger>
            <TabsTrigger value="brand" className="flex-shrink-0">Brand Identity</TabsTrigger>
            <TabsTrigger value="social" className="flex-shrink-0">Social Profiles</TabsTrigger>
            <TabsTrigger value="planning" className="flex-shrink-0">Content Planning</TabsTrigger>
            <TabsTrigger value="library" className="flex-shrink-0">Content Library</TabsTrigger>
            <TabsTrigger value="workspace" className="flex-shrink-0">Workspace</TabsTrigger>
            <TabsTrigger value="uploads" className="flex-shrink-0">Client Uploads</TabsTrigger>
            <TabsTrigger value="portal" className="flex-shrink-0">Client Portal</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab 
            clientId={clientId!} 
            client={client} 
            onNotesUpdate={handleNotesUpdate}
          />
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
          <ContentLibraryTab clientId={clientId!} agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <WorkspaceTab 
            clientId={clientId!}
            initialNotes={client.notes}
            onNotesUpdate={handleNotesUpdate}
          />
        </TabsContent>

        <TabsContent value="uploads" className="space-y-4">
          <ClientUploadsTab clientId={clientId!} agencyId={agencyId} />
        </TabsContent>

        <TabsContent value="portal" className="space-y-4">
          <ClientPortalTab clientId={clientId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
