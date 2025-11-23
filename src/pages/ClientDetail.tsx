import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ClientHeader from "@/components/ClientHeader";
import SocialProfilesTab from "@/components/SocialProfilesTab";
import OverviewTab from "@/components/client-tabs/OverviewTab";
import TasksTab from "@/components/client-tabs/TasksTab";
import ContentCalendarTab from "@/components/client-tabs/ContentCalendarTab";

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

export default function ClientDetail() {
  const { clientId } = useParams();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
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
        name={client.name}
        logoUrl={client.logo_url}
        niche={client.niche}
        website={client.website}
        brandColors={client.brand_colors}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="social">Social Profiles</TabsTrigger>
          <TabsTrigger value="calendar">Content Calendar</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab 
            clientId={clientId!} 
            client={client} 
            onNotesUpdate={handleNotesUpdate}
          />
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <SocialProfilesTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <ContentCalendarTab />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <TasksTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
