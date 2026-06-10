import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useClientExecutionTasks } from "@/hooks/useClientOperations";
import { Copy, Trash2, Mail } from "lucide-react";
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
import { PortalInviteDialog } from "./PortalInviteDialog";

interface ClientPortalTabProps {
  clientId: string;
}

interface PortalUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
}

interface PortalInvite {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  expires_at: string;
  accepted: boolean;
}

export function ClientPortalTab({ clientId }: ClientPortalTabProps) {
  const { toast } = useToast();
  const { data: executionTasks = [] } = useClientExecutionTasks(clientId);
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalSlug, setPortalSlug] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [portalInvites, setPortalInvites] = useState<PortalInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteInviteId, setDeleteInviteId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const portalUrl = portalSlug
    ? `${window.location.origin}/client/login/${portalSlug}`
    : "";

  useEffect(() => {
    fetchPortalData();
  }, [clientId]);

  const fetchPortalData = async () => {
    try {
      const { data: client } = await supabase
        .from("clients")
        .select("portal_enabled, portal_slug, name")
        .eq("id", clientId)
        .single();

      if (client) {
        setPortalEnabled(client.portal_enabled);
        setPortalSlug(client.portal_slug);
        setClientName(client.name);
      }

      // Fetch active users
      const { data: users } = await supabase
        .from("client_users")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      setPortalUsers(users || []);

      // Fetch pending invites
      const { data: invites } = await supabase
        .from("client_invites")
        .select("*")
        .eq("client_id", clientId)
        .eq("accepted", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      setPortalInvites(invites || []);
    } catch (error) {
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
          ? "Your client portal is now active."
          : "The client portal has been disabled.",
      });
    } catch (error) {
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
      description: "Portal login link copied to clipboard.",
    });
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const { error } = await supabase
        .from("client_users")
        .delete()
        .eq("id", deleteUserId);

      if (error) throw error;

      toast({
        title: "User Deleted",
        description: "User access has been revoked.",
      });

      setDeleteUserId(null);
      fetchPortalData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInvite = async () => {
    if (!deleteInviteId) return;

    try {
      const { error } = await supabase
        .from("client_invites")
        .delete()
        .eq("id", deleteInviteId);

      if (error) throw error;

      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled.",
      });

      setDeleteInviteId(null);
      fetchPortalData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel invitation.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const clientActionItems = executionTasks.filter(
    (task) => ["waiting_on_client", "blocked"].includes(task.status) && (task.owner === "client" || task.owner === "shared"),
  );

  return (
    <div className="space-y-6">
      {clientActionItems.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Client action items</h3>
              <p className="text-sm text-muted-foreground">
                Work that is currently waiting on client access, input, approvals, or assets.
              </p>
            </div>
            <Badge variant="outline">{clientActionItems.length} active</Badge>
          </div>

          <div className="space-y-3">
            {clientActionItems.slice(0, 5).map((task) => (
              <div key={task.id} className="rounded-lg border border-border/60 bg-background/40 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{task.title}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={task.priority === "urgent" ? "destructive" : "secondary"}>
                      {task.priority}
                    </Badge>
                    <Badge variant="outline">{task.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {task.description || "Client input is required before this work can continue."}
                </div>
                {task.resolution_note && (
                  <div className="mt-1 text-xs text-muted-foreground">Latest note: {task.resolution_note}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Portal Status Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Portal Status</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enable the client portal to allow invited users to access their workspace.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Client Portal</Label>
              <p className="text-sm text-muted-foreground">
                Allow invited users to access this client portal
              </p>
            </div>
            <Switch
              checked={portalEnabled}
              onCheckedChange={handleTogglePortal}
            />
          </div>

          {portalEnabled && portalSlug && (
            <div className="space-y-2 pt-4 border-t">
              <Label>Client Login Page</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Share this link with invited clients to log in.
              </p>
              <div className="flex gap-2">
                <Input 
                  value={portalUrl} 
                  readOnly 
                  className="flex-1 font-mono text-sm" 
                />
                <Button onClick={copyPortalLink} variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Portal Users & Invitations */}
      {portalEnabled && (
        <>
          {/* Active Users */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Active Users</h3>
                  <p className="text-sm text-muted-foreground">
                    Users who have accepted invitations
                  </p>
                </div>
              </div>

              {portalUsers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portalUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.full_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.last_login_at 
                            ? new Date(user.last_login_at).toLocaleDateString()
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteUserId(user.id)}
                            title="Delete user"
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
                  No active users yet.
                </div>
              )}
            </div>
          </Card>

          {/* Pending Invitations */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Pending Invitations</h3>
                  <p className="text-sm text-muted-foreground">
                    Invitations that haven't been accepted yet
                  </p>
                </div>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </div>

              {portalInvites.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portalInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>{invite.full_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{invite.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(invite.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteInviteId(invite.id)}
                            title="Cancel invitation"
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
                  No pending invitations. Click "Invite User" to send an invitation.
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <PortalInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        clientId={clientId}
        clientName={clientName}
        portalSlug={portalSlug || ""}
        onInviteSent={fetchPortalData}
      />

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? They will no longer be able to access the portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invite Confirmation */}
      <AlertDialog open={!!deleteInviteId} onOpenChange={() => setDeleteInviteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this invitation?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvite}>
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
