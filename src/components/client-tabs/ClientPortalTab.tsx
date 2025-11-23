import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
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

interface ClientPortalTabProps {
  clientId: string;
}

interface PortalUser {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

export function ClientPortalTab({ clientId }: ClientPortalTabProps) {
  const { toast } = useToast();
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalSlug, setPortalSlug] = useState<string | null>(null);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const portalUrl = portalSlug
    ? `${window.location.origin}/client-portal/${portalSlug}`
    : "";

  useEffect(() => {
    fetchPortalData();
  }, [clientId]);

  const fetchPortalData = async () => {
    try {
      const { data: client } = await supabase
        .from("clients")
        .select("portal_enabled, portal_slug")
        .eq("id", clientId)
        .single();

      if (client) {
        setPortalEnabled(client.portal_enabled);
        setPortalSlug(client.portal_slug);
      }

      // Fetch users who have accessed this portal
      const { data: users } = await supabase
        .from("client_portal_users")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      setPortalUsers(users || []);
    } catch (error) {
      console.error("Error fetching portal data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePortal = async (enabled: boolean) => {
    try {
      let updates: any = { portal_enabled: enabled };

      // Generate slug if enabling for the first time
      if (enabled && !portalSlug) {
        const { data: slugData } = await supabase.rpc("generate_portal_slug");
        updates.portal_slug = slugData;
        setPortalSlug(slugData);
      }

      const { error } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", clientId);

      if (error) throw error;

      setPortalEnabled(enabled);
      toast({
        title: enabled ? "Portal Enabled" : "Portal Disabled",
        description: enabled
          ? "Your client portal is now accessible to anyone with the link."
          : "The client portal has been disabled.",
      });
    } catch (error) {
      console.error("Error toggling portal:", error);
      toast({
        title: "Error",
        description: "Failed to update portal status.",
        variant: "destructive",
      });
    }
  };

  const copyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl);
    toast({
      title: "Link Copied",
      description: "Portal link copied to clipboard.",
    });
  };

  const handleRevokeAccess = async () => {
    if (!deleteUserId) return;

    try {
      const { error } = await supabase
        .from("client_portal_users")
        .delete()
        .eq("id", deleteUserId);

      if (error) throw error;

      toast({
        title: "Access Revoked",
        description: "User access has been revoked.",
      });

      setDeleteUserId(null);
      fetchPortalData();
    } catch (error) {
      console.error("Error revoking access:", error);
      toast({
        title: "Error",
        description: "Failed to revoke access.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Portal Status Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Portal Status</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enable the client portal and share the unique link with your client. Anyone with the link can create an account and access the portal.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Client Portal</Label>
              <p className="text-sm text-muted-foreground">
                Allow anyone with the link to access this client portal
              </p>
            </div>
            <Switch
              checked={portalEnabled}
              onCheckedChange={handleTogglePortal}
            />
          </div>

          {portalEnabled && portalSlug && (
            <div className="space-y-2 pt-4 border-t">
              <Label>Portal Link</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Share this unique link with your client. Anyone with this link can create an account and access the portal.
              </p>
              <div className="flex gap-2">
                <Input value={portalUrl} readOnly className="flex-1" />
                <Button onClick={copyPortalLink} variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(portalUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Portal Access Activity */}
      {portalEnabled && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Portal Access Activity</h3>
              <p className="text-sm text-muted-foreground">
                Users who have accessed this portal
              </p>
            </div>

            {portalUsers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>First Accessed</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name || "—"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteUserId(user.id)}
                          title="Revoke access"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No one has accessed this portal yet. Share the portal link with your client to get started.
              </div>
            )}
          </div>
        </Card>
      )}

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this user's portal access? They will no longer be able to log in to this client portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeAccess}>
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
