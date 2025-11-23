import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ClientHeader from "@/components/ClientHeader";
import OverviewTab from "@/components/client-tabs/OverviewTab";
import BrandIdentityTab from "@/components/client-tabs/BrandIdentityTab";
import ContentPlanningTab from "@/components/client-tabs/ContentPlanningTab";
import ContentLibraryTab from "@/components/client-tabs/ContentLibraryTab";
import WorkspaceTab from "@/components/client-tabs/WorkspaceTab";

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
}

interface ClientBranding {
  primary_color: string | null;
}

export default function ClientDetail() {
  const { clientId } = useParams();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [branding, setBranding] = useState<ClientBranding | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-6">
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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="brand">Brand Identity</TabsTrigger>
          <TabsTrigger value="planning">Content Planning</TabsTrigger>
          <TabsTrigger value="library">Content Library</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab 
            clientId={clientId!} 
            client={client} 
            onNotesUpdate={handleNotesUpdate}
          />
        </TabsContent>

        <TabsContent value="brand" className="space-y-4">
          <BrandIdentityTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <ContentPlanningTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <ContentLibraryTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="workspace" className="space-y-4">
          <WorkspaceTab 
            clientId={clientId!}
            initialNotes={client.notes}
            onNotesUpdate={handleNotesUpdate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
