import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Connection {
  id: string;
  platform: string;
  account_name: string | null;
  account_handle: string | null;
  status: string;
}

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: "📷" },
  { id: "facebook", name: "Facebook", icon: "👤" },
  { id: "linkedin", name: "LinkedIn", icon: "💼" },
];

export default function SocialConnectionsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [user]);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get all social connections for this user's agency
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agency) return;

      // Get all clients for this agency first
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .eq("agency_id", agency.id);

      const clientIds = clients?.map((c) => c.id) || [];

      if (clientIds.length === 0) {
        setConnections([]);
        return;
      }

      const { data, error } = await supabase
        .from("social_connections")
        .select("id, platform, account_name, account_handle, status")
        .in("client_id", clientIds);

      if (error) throw error;
      setConnections(data || []);
    } catch (error: any) {
      console.error("Error fetching connections:", error);
      toast({
        title: "Error",
        description: "Failed to load social connections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    toast({
      title: "Coming Soon",
      description: "OAuth integration will be available soon",
    });
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from("social_connections")
        .delete()
        .eq("id", connectionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Connection removed successfully",
      });
      setDisconnecting(null);
      fetchConnections();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to disconnect",
        variant: "destructive",
      });
    }
  };

  const getConnectionForPlatform = (platformId: string) => {
    return connections.find((c) => c.platform === platformId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Social Connections</CardTitle>
          <CardDescription>
            Manage global OAuth settings for social media platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PLATFORMS.map((platform) => {
              const connection = getConnectionForPlatform(platform.id);
              const isConnected = connection?.status === "connected";

              return (
                <Card key={platform.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{platform.icon}</span>
                        <CardTitle className="text-lg">
                          {platform.name}
                        </CardTitle>
                      </div>
                      <Badge variant={isConnected ? "default" : "secondary"}>
                        {isConnected ? "Connected" : "Not Connected"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {connection && isConnected && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        {connection.account_name && (
                          <p>
                            <strong>Account:</strong> {connection.account_name}
                          </p>
                        )}
                        {connection.account_handle && (
                          <p>
                            <strong>Handle:</strong> @{connection.account_handle}
                          </p>
                        )}
                      </div>
                    )}

                    {isConnected ? (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => setDisconnecting(connection.id)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleConnect(platform.id)}
                      >
                        Connect
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!disconnecting}
        onOpenChange={() => setDisconnecting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Platform</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this platform? This will
              affect all clients using this connection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnecting && handleDisconnect(disconnecting)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
