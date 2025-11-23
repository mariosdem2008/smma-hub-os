import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Instagram, Facebook } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  useEffect(() => {
    fetchClients();
  }, [user]);

  const fetchClients = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencies) {
        setLoading(false);
        return;
      }

      const { data: clientsData } = await supabase
        .from("clients")
        .select("*, assets(count), ideas(count)")
        .eq("agency_id", agencies.id);

      setClients(clientsData || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async () => {
    if (!user || !newClientName.trim()) return;

    try {
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencies) {
        toast({
          title: "Error",
          description: "Agency not found. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          agency_id: agencies.id,
          name: newClientName,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Client created",
        description: "Your new client has been added successfully.",
      });

      setShowNewClientDialog(false);
      setNewClientName("");
      navigate(`/clients/${client.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {user?.user_metadata?.full_name || "User"}</h1>
          <p className="text-muted-foreground">Manage your clients and their projects</p>
        </div>
        <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Enter client name"
                />
              </div>
              <Button onClick={handleCreateClient} className="w-full">
                Create Client
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Loading clients...</div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-muted-foreground">No clients yet</p>
            <Button onClick={() => setShowNewClientDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="overflow-hidden hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt={client.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                      {client.name.charAt(0)}
                    </div>
                  )}
                </div>
                <CardTitle className="mt-3">{client.name}</CardTitle>
                {client.company && <CardDescription>{client.company}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  {client.instagram_url && (
                    <Button size="icon" variant="outline" asChild>
                      <a href={client.instagram_url} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {client.facebook_url && (
                    <Button size="icon" variant="outline" asChild>
                      <a href={client.facebook_url} target="_blank" rel="noopener noreferrer">
                        <Facebook className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {client.website && (
                    <Button size="icon" variant="outline" asChild>
                      <a href={client.website} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{client.assets?.[0]?.count || 0} Assets</span>
                  <span>{client.ideas?.[0]?.count || 0} Ideas</span>
                </div>
                <Button className="w-full" onClick={() => navigate(`/clients/${client.id}`)}>
                  View Workspace
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
