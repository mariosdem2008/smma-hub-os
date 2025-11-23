import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { Plus, Mail, Phone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  created_at: string;
}

export default function Clients() {
  const { user } = useAuth();
  const { canManageClients } = useRole();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      if (!user) return;

      // Get agency
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agency) {
        // Create agency if it doesn't exist
        const { data: newAgency, error } = await supabase
          .from("agencies")
          .insert({ user_id: user.id, name: "My Agency" })
          .select()
          .single();

        if (error) {
          toast({
            title: "Error",
            description: "Failed to create agency",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        setLoading(false);
        return;
      }

      // Get clients
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("agency_id", agency.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch clients",
          variant: "destructive",
        });
      } else {
        setClients(data || []);
      }

      setLoading(false);
    };

    fetchClients();
  }, [user, toast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-status-active";
      case "inactive":
        return "bg-status-inactive";
      case "paused":
        return "bg-status-paused";
      default:
        return "bg-muted";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage your client accounts</p>
        </div>
        {canManageClients && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        )}
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {canManageClients 
                ? "Get started by adding your first client"
                : "No clients have been added yet"}
            </p>
            {canManageClients && (
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} to={`/clients/${client.id}`}>
              <Card className="hover:bg-card/80 cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{client.name}</CardTitle>
                      {client.company && (
                        <CardDescription>{client.company}</CardDescription>
                      )}
                    </div>
                    <Badge className={getStatusColor(client.status)}>
                      {client.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {client.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
