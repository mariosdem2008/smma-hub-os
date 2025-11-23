import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendPortalInviteEmail } from "@/lib/invitations";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Trash2, ExternalLink } from "lucide-react";
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
  const { user } = useAuth();
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalSlug, setPortalSlug] = useState<string | null>(null);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [agencyName, setAgencyName] = useState<string>("");

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
        .select("portal_enabled, portal_slug, name, agency_id")
        .eq("id", clientId)
        .single();

      if (client) {
        setPortalEnabled(client.portal_enabled);
        setPortalSlug(client.portal_slug);
        setClientName(client.name);

        // Get agency name
        const { data: agency } = await supabase
          .from("agencies")
          .select("name")
          .eq("id", client.agency_id)
          .single();
        
        if (agency) {
          setAgencyName(agency.name);
        }
      }

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
          ? "Your client portal is now accessible."
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

  const handleInviteUser = async () => {
    if (!inviteEmail) {
      toast({
        title: "Error",
        description: "Email is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if user already has access
      const { data: existing } = await supabase
        .from("client_portal_users")
        .select("id")
        .eq("client_id", clientId)
        .eq("email", inviteEmail.toLowerCase())
        .maybeSingle();

      if (existing) {
        toast({
          title: "Already Invited",
          description: "This user already has access to the portal.",
          variant: "destructive",
        });
        return;
      }

      // Create portal user record (user_id will be set when they sign up)
      const { error: insertError } = await supabase
        .from("client_portal_users")
        .insert({
          client_id: clientId,
          email: inviteEmail.toLowerCase(),
          name: inviteName || null,
        });

      if (insertError) throw insertError;

      // Get user's profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();

      // Send email invitation
      const emailResult = await sendPortalInviteEmail({
        email: inviteEmail,
        clientName: clientName,
        portalUrl: portalUrl,
        agencyName: agencyName,
        inviterName: profile?.full_name || user?.email || "Your Agency",
      });

      if (emailResult.success) {
        toast({
          title: "Invite Sent",
          description: `${inviteEmail} has been invited and will receive an email with portal access instructions.`,
        });
      } else {
        toast({
          title: "Portal Access Granted",
          description: `${inviteEmail} has been granted access. Email could not be sent, please share the portal link manually.`,
        });
      }

      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      fetchPortalData();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation.",
        variant: "destructive",
      });
    }
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
              Share this portal with your client so they can view branding, assets, and add ideas.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Client Portal</Label>
              <p className="text-sm text-muted-foreground">
                Allow clients to access their dedicated portal
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
                Share this link with invited clients so they can create an account and access the portal
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

      {/* Client Contacts & Access Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Client Contacts & Access</h3>
              <p className="text-sm text-muted-foreground">
                Manage who can access this client portal
              </p>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Client User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Client User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Add a client user who can access this portal. After inviting, share the portal link with them.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleInviteUser} className="w-full">
                    Add to Portal Access
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {portalUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Invited</TableHead>
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
              No client users invited yet. Click "Invite Client User" to get started.
            </div>
          )}
        </div>
      </Card>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this user's portal access? They will no longer be able to view or interact with this client portal.
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
