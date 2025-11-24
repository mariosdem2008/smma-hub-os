import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/hooks/use-toast";
import { 
  Instagram, 
  Facebook, 
  Linkedin, 
  Youtube,
  MoreVertical,
  RefreshCw,
  Unplug,
  Check,
  AlertCircle,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SocialConnection {
  id: string;
  platform: string;
  account_name: string | null;
  account_handle: string | null;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

interface SocialConnectionsSectionProps {
  clientId: string;
}

const PLATFORMS = [
  { 
    id: "instagram", 
    name: "Instagram", 
    icon: Instagram,
    color: "from-purple-500 to-pink-500"
  },
  { 
    id: "facebook", 
    name: "Facebook", 
    icon: Facebook,
    color: "from-blue-600 to-blue-500"
  },
  { 
    id: "tiktok", 
    name: "TikTok", 
    icon: ({ className }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ),
    color: "from-black to-gray-800"
  },
  { 
    id: "youtube", 
    name: "YouTube", 
    icon: Youtube,
    color: "from-red-600 to-red-500"
  },
  { 
    id: "linkedin", 
    name: "LinkedIn", 
    icon: Linkedin,
    color: "from-blue-700 to-blue-600"
  },
];

export default function SocialConnectionsSection({ clientId }: SocialConnectionsSectionProps) {
  const { toast } = useToast();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<{ open: boolean; connectionId: string | null }>({
    open: false,
    connectionId: null,
  });

  useEffect(() => {
    fetchConnections();
  }, [clientId]);

  const fetchConnections = async () => {
    setLoading(true);
    // Use safe view that excludes OAuth tokens for security
    const { data, error } = await supabase
      .from("social_connections_safe")
      .select("*")
      .eq("client_id", clientId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch social connections",
        variant: "destructive",
      });
    } else {
      setConnections(data || []);
    }
    setLoading(false);
  };

  const handleConnect = async (platformId: string) => {
    setConnectingPlatform(platformId);
    
    try {
      // Call edge function to initiate OAuth flow
      const { data, error } = await supabase.functions.invoke("social-oauth", {
        body: { 
          action: "connect",
          platform: platformId,
          clientId: clientId,
        },
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.authUrl;
      } else {
        throw new Error("No auth URL returned");
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "Failed to initiate connection. Please ensure OAuth credentials are configured.",
        variant: "destructive",
      });
      setConnectingPlatform(null);
    }
  };

  const handleReauthenticate = async (connectionId: string, platform: string) => {
    setConnectingPlatform(platform);
    
    try {
      const { data, error } = await supabase.functions.invoke("social-oauth", {
        body: { 
          action: "reconnect",
          platform: platform,
          clientId: clientId,
          connectionId: connectionId,
        },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error("No auth URL returned");
      }
    } catch (error) {
      toast({
        title: "Re-authentication Error",
        description: error instanceof Error ? error.message : "Failed to re-authenticate",
        variant: "destructive",
      });
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog.connectionId) return;

    const { error } = await supabase
      .from("social_connections")
      .delete()
      .eq("id", disconnectDialog.connectionId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect account",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Account disconnected successfully",
      });
      fetchConnections();
    }

    setDisconnectDialog({ open: false, connectionId: null });
  };

  const getConnectionForPlatform = (platformId: string) => {
    return connections.find(conn => conn.platform === platformId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <Check className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-error/10 text-error border-error/20">
            <AlertCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Not connected
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-pulse text-muted-foreground">Loading connections...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">API Connections</h3>
        <p className="text-sm text-muted-foreground">
          Connect social media accounts to sync data and automate posting
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const connection = getConnectionForPlatform(platform.id);
          const Icon = platform.icon;
          const isConnecting = connectingPlatform === platform.id;

          return (
            <Card key={platform.id} className="overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${platform.color}`} />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${platform.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-sm font-medium">
                    {platform.name}
                  </CardTitle>
                </div>
                {connection && connection.status === "connected" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleReauthenticate(connection.id, platform.id)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Re-authenticate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          setDisconnectDialog({ open: true, connectionId: connection.id })
                        }
                      >
                        <Unplug className="mr-2 h-4 w-4" />
                        Disconnect
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  {getStatusBadge(connection?.status || "disconnected")}
                </div>

                {connection && connection.status === "connected" && (
                  <div className="space-y-2">
                    {connection.account_handle && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Handle: </span>
                        <span className="font-medium">@{connection.account_handle}</span>
                      </div>
                    )}
                    {connection.account_name && (
                      <div className="text-sm truncate">
                        <span className="text-muted-foreground">Name: </span>
                        <span className="font-medium">{connection.account_name}</span>
                      </div>
                    )}
                    {connection.last_synced_at && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last synced {formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                )}

                {(!connection || connection.status !== "connected") && (
                  <Button
                    className="w-full"
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>Connect {platform.name}</>
                    )}
                  </Button>
                )}

                {connection && connection.status === "error" && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleReauthenticate(connection.id, platform.id)}
                    disabled={isConnecting}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Connection
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog
        open={disconnectDialog.open}
        onOpenChange={(open) => setDisconnectDialog({ open, connectionId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this social media account? This will remove all
              stored credentials and stop data syncing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
