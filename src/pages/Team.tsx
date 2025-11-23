import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PlanGuard } from "@/components/PlanGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Users, Copy, Trash2, AlertCircle, ArrowRight } from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile: {
    email: string;
    full_name: string | null;
  } | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted: boolean;
}

const ROLES = ["admin", "manager", "creator", "viewer"];

export default function Team() {
  const { user } = useAuth();
  const { canManageTeam, isOwner: userIsOwner, loading: roleLoading } = useRole();
  const { limits } = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agencyId, setAgencyId] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserPlan, setCurrentUserPlan] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLink, setInviteLink] = useState("");
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [inviteToCancel, setInviteToCancel] = useState<string | null>(null);

  const isAtLimit = limits?.teamMembers !== null && teamMembers.length >= limits.teamMembers;

  useEffect(() => {
    fetchTeamData();
  }, [user]);

  const fetchTeamData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get agency
      const { data: agency, error: agencyError } = await supabase
        .from("agencies")
        .select("id, user_id")
        .eq("user_id", user.id)
        .single();

      if (agencyError) throw agencyError;

      setAgencyId(agency.id);
      setIsOwner(true); // User who owns the agency is the owner
      
      // Get owner's subscription plan
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_type")
        .eq("user_id", agency.user_id)
        .single();
      
      setCurrentUserPlan(subscription?.plan_type || 'free');

      // Fetch team members
      const { data: members, error: membersError } = await supabase
        .from("agency_members")
        .select("*")
        .eq("agency_id", agency.id)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;

      // Fetch profiles for all members
      const userIds = members?.map((m) => m.user_id) || [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]));

        const membersWithProfiles = members?.map((member) => ({
          ...member,
          profile: profileMap.get(member.user_id) || null,
        }));

        setTeamMembers(membersWithProfiles || []);
      } else {
        setTeamMembers([]);
      }

      // Fetch pending invites
      const { data: invites, error: invitesError } = await supabase
        .from("agency_invites")
        .select("*")
        .eq("agency_id", agency.id)
        .eq("accepted", false)
        .order("created_at", { ascending: false });

      if (invitesError) throw invitesError;
      setPendingInvites(invites || []);
    } catch (error: any) {
      console.error("Error fetching team data:", error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !agencyId) {
      toast({
        title: "Validation Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: invite, error } = await supabase
        .from("agency_invites")
        .insert({
          agency_id: agencyId,
          email: inviteEmail,
          role: inviteRole,
        })
        .select()
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/invite/${invite.token}`;
      setInviteLink(link);
      setShowInviteLink(true);

      toast({
        title: "Success",
        description: "Invitation created successfully",
      });

      setInviteEmail("");
      setInviteRole("member");
      fetchTeamData(); // Refresh to show new invite in pending list
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create invitation",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: "Copied",
      description: "Invite link copied to clipboard",
    });
  };

  const handleCopyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied",
      description: "Invite link copied to clipboard",
    });
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
        description: "Invitation cancelled",
      });

      setInviteToCancel(null);
      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    }
  };

  const getInviteStatus = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    return expiry > now ? "Pending" : "Expired";
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    // Check if trying to promote to admin and user doesn't have Agency Plus
    if (newRole === 'admin' && currentUserPlan !== 'agency_plus') {
      toast({
        title: "Upgrade Required",
        description: "Multi-admin feature requires Agency Plus plan",
        variant: "destructive",
      });
      openUpgradeModal({ feature: 'Multi-admin', suggestedPlan: 'agency_plus' });
      return;
    }

    try {
      const { error } = await supabase
        .from("agency_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) {
        // Check if it's the multi-admin limit error
        if (error.message.includes('Multi-admin feature requires Agency Plus plan')) {
          toast({
            title: "Upgrade Required",
            description: "Multi-admin feature requires Agency Plus plan",
            variant: "destructive",
          });
          openUpgradeModal({ feature: 'Multi-admin', suggestedPlan: 'agency_plus' });
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Member role updated",
      });

      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
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
        description: "Team member removed",
      });

      setMemberToRemove(null);
      fetchTeamData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "default"; // Same as owner
      case "manager":
        return "secondary";
      case "creator":
        return "outline";
      default:
        return "outline";
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading team...</div>
      </div>
    );
  }

  if (!canManageTeam) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">You don't have permission to manage team members.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Management</h1>
        <p className="text-muted-foreground">Manage your agency team members and invitations</p>
      </div>

      {/* Multi-Admin Feature Info for Agency Plus */}
      {currentUserPlan === 'agency_plus' && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Users className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Multi-Admin Enabled</h3>
                <p className="text-sm text-muted-foreground">
                  Your Agency Plus plan allows you to promote team members to Admin role. 
                  Admins have full management permissions including inviting members, managing roles, and editing agency settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Prompt - Team Member Limit Reached */}
      {isAtLimit && (
        <Card className="border-primary bg-primary/5 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Team member limit reached</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add unlimited team members with Pro or Agency Plus plans.
                </p>
                <Button onClick={() => openUpgradeModal({ feature: 'More team members' })} size="sm">
                  Upgrade Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Team Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Current Team
          </CardTitle>
          <CardDescription>View and manage your agency team members</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No team members yet. Invite your first member below!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  {isOwner && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.profile?.email || "N/A"}
                    </TableCell>
                    <TableCell>
                      {member.profile?.full_name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.role !== "owner" && (
                            <>
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  handleRoleChange(member.id, value)
                                }
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {role.charAt(0).toUpperCase() + role.slice(1)}
                                      {role === 'admin' && currentUserPlan !== 'agency_plus' && (
                                        <span className="text-xs text-muted-foreground ml-1">(Agency Plus)</span>
                                      )}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setMemberToRemove(member.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {member.role === "admin" && (
                            <Badge variant="secondary" className="ml-2">
                              Agency Plus Feature
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites Section */}
      {isOwner && pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>Manage outstanding team invitations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => {
                  const status = getInviteStatus(invite.expires_at);
                  return (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(invite.role)}>
                          {invite.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status === "Expired" ? "destructive" : "secondary"}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyInviteLink(invite.token)}
                            title="Copy invite link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setInviteToCancel(invite.id)}
                            title="Cancel invite"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Team Member Section */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Team Member</CardTitle>
            <CardDescription>Send an invitation to join your agency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem 
                        key={role} 
                        value={role}
                        disabled={role === 'admin' && currentUserPlan !== 'agency_plus'}
                      >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                        {role === 'admin' && currentUserPlan !== 'agency_plus' && (
                          <span className="text-xs text-muted-foreground ml-1">(Agency Plus)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {inviteRole === 'admin' && currentUserPlan === 'agency_plus' && (
                  <p className="text-xs text-muted-foreground">
                    Admins have full management permissions like owners
                  </p>
                )}
              </div>
            </div>

            <PlanGuard feature="teamMembers" requiredPlan="starter">
              <Button onClick={handleInvite} disabled={submitting}>
                {submitting ? "Sending..." : "Send Invitation"}
              </Button>
            </PlanGuard>

            {showInviteLink && (
              <Card className="bg-muted">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Label>Invitation Link</Label>
                    <div className="flex gap-2">
                      <Input
                        value={inviteLink}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this link with your team member. It expires in 7 days.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this team member? They will lose access to the agency and all its clients.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invite Confirmation Dialog */}
      <AlertDialog open={!!inviteToCancel} onOpenChange={() => setInviteToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this invitation? The invite link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => inviteToCancel && handleCancelInvite(inviteToCancel)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Invite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
