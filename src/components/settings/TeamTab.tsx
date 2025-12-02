import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";
import { InviteTeamMemberDialog } from "@/components/InviteTeamMemberDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  accepted_at: string | null;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted: boolean;
  token: string;
}

export default function TeamTab() {
  const { user } = useAuth();
  const { canManageTeam, isOwner } = useRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string>("");

  useEffect(() => {
    fetchTeamData();
  }, [user]);

  const fetchTeamData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get agency ID
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agency) return;
      setAgencyId(agency.id);

      // Get team members with profile data
      const { data: membersData, error: membersError } = await supabase
        .from("agency_members")
        .select("id, user_id, role, accepted_at")
        .eq("agency_id", agency.id);

      if (membersError) throw membersError;

      // Fetch profiles for each member
      const teamData = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", member.user_id)
            .single();

          return {
            ...member,
            profiles: profile || { full_name: null, email: "" },
          };
        })
      );

      setMembers(teamData);

      // Get pending invites
      const { data: invitesData, error: invitesError } = await supabase
        .from("agency_invites")
        .select("*")
        .eq("agency_id", agency.id)
        .eq("accepted", false);

      if (invitesError) throw invitesError;
      setInvites(invitesData || []);
    } catch (error: any) {
      console.error("Error fetching team:", error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("agency_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role updated successfully",
      });
      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("agency_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed successfully",
      });
      setRemovingMember(null);
      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("agency_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invite cancelled",
      });
      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to cancel invite",
        variant: "destructive",
      });
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Success",
      description: "Invite link copied to clipboard",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage your agency team and permissions
              </CardDescription>
            </div>
            {canManageTeam && (
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {canManageTeam && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const isOwnerMember = member.role === "owner";
                const canEditThisMember = canManageTeam && !isOwnerMember;
                const canRemoveThisMember = canManageTeam && !isOwnerMember && !isCurrentUser;

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      {member.profiles?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell>{member.profiles?.email}</TableCell>
                    <TableCell>
                      {canEditThisMember ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) =>
                            handleRoleChange(member.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner" disabled>
                              Owner
                            </SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="creator">Creator</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{member.role}</Badge>
                      )}
                    </TableCell>
                    {canManageTeam && (
                      <TableCell>
                        {canRemoveThisMember && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setRemovingMember(member.id)}
                          >
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>
              Outstanding invitations to join your agency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageTeam && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => {
                  const isExpired = new Date(invite.expires_at) < new Date();
                  return (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invite.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isExpired ? "destructive" : "default"}>
                          {isExpired ? "Expired" : "Pending"}
                        </Badge>
                      </TableCell>
                      {canManageTeam && (
                        <TableCell className="space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyInviteLink(invite.token)}
                          >
                            Copy Link
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            Cancel
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <InviteTeamMemberDialog
        open={inviteDialogOpen && canManageTeam}
        onOpenChange={(open) => {
          setInviteDialogOpen(open);
          if (!open) fetchTeamData();
        }}
      />

      <AlertDialog
        open={!!removingMember}
        onOpenChange={() => setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member? They will lose access
              to all agency data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                removingMember && handleRemoveMember(removingMember)
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
