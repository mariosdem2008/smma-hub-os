// deno-lint-ignore-file no-unused-vars no-explicit-any
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

import {
  getMyAgency,
  listAgencyMembersWithProfiles,
  listPendingAgencyInvites,
  createAgencyInvite,
  cancelAgencyInvite,
  sendTeamInviteEmail,
  getOwnerSubscriptionPlan,
  getProfileByEmail,
  isUserAgencyMember,
  updateAgencyMemberRole,
  removeAgencyMember,
  getAgencyMemberIdsByUserIds,
} from "../data/index.ts";

import {
  Users,
  Copy,
  Trash2,
  AlertCircle,
  ArrowRight,
  MessageSquare,
  Shield,
  Crown,
  UserPlus,
  Mail,
  CheckCircle,
  XCircle,
  MoreVertical,
  Settings,
  BarChart3,
  UserCog,
  Building,
  Table,
} from "lucide-react";
import { PlanGuard } from "../components/PlanGuard.tsx";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "../components/ui/alert-dialog.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card.tsx";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";
import { Progress } from "../components/ui/progress.tsx";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select.tsx";
import { Separator } from "../components/ui/separator.tsx";
import { TableHeader, TableRow, TableHead, TableBody, TableCell } from "../components/ui/table.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs.tsx";
import { useUpgradeModal } from "../contexts/UpgradeModalContext.tsx";
import { useToast } from "../hooks/use-toast.ts";
import { useCreateConversation } from "../hooks/useCreateConversation.ts";
import { usePlanLimits } from "../hooks/usePlanLimits.ts";
import { useRole } from "../hooks/useRole.ts";
import { useAuth } from "../lib/auth.tsx";
import { Badge } from "../components/ui/badge.tsx";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile: {
    email: string;
    full_name: string | null;
    avatar_url?: string | null;
  } | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  token: string | null;
  created_at: string;
  expires_at: string | null;
  accepted: boolean;
}

const ROLES = ["admin", "manager", "member"];

const ROLE_DESCRIPTIONS = {
  owner: "Full system access, billing management, and agency ownership",
  admin: "Full management permissions including team, clients, and content",
  manager: "Can manage clients and content, limited team permissions",
  member: "Content creation and client management only",
};

export default function Team() {
  const { user } = useAuth();
  const { canManageTeam, canRemoveTeamMembers, isOwner: userIsOwner, loading: roleLoading } = useRole();
  const { limits } = usePlanLimits();
  const { openUpgradeModal } = useUpgradeModal();
  const { toast } = useToast();
  const navigate = useNavigate();
  const createConversation = useCreateConversation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agencyId, setAgencyId] = useState<string>("");
  const [agencyName, setAgencyName] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserPlan, setCurrentUserPlan] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [inviteLink, setInviteLink] = useState("");
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [inviteToCancel, setInviteToCancel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("members");

  const isAtLimit = limits?.teamMembers !== null && teamMembers.length >= limits.teamMembers;
  const teamUtilization = limits?.teamMembers ? (teamMembers.length / limits.teamMembers) * 100 : 0;

  useEffect(() => {
    fetchTeamData();
  }, [user]);

  const fetchTeamData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const agency = await getMyAgency();
      setAgencyId(agency.id);
      setAgencyName(agency.name);
      setIsOwner(agency.user_id === user.id);
      
      const plan = await getOwnerSubscriptionPlan(agency.user_id);
      setCurrentUserPlan(plan);

      const membersWithProfiles = await listAgencyMembersWithProfiles();
      setTeamMembers(membersWithProfiles as TeamMember[]);

      const invites = await listPendingAgencyInvites();
      setPendingInvites(invites as PendingInvite[]);
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
      const existingProfile = await getProfileByEmail(inviteEmail);

      if (existingProfile) {
        const isMember = await isUserAgencyMember(agencyId, existingProfile.id);

        if (isMember) {
          toast({
            title: "Already a Member",
            description: "This user is already part of your agency",
            variant: "destructive",
          });
          setSubmitting(false);
          return;
        }
      }

      const inviteRow = await createAgencyInvite(inviteEmail, inviteRole);
      const link = inviteRow.token ? `${globalThis.location.origin}/invite/${inviteRow.token}` : "";
      setInviteLink(link);
      setShowInviteLink(Boolean(inviteRow.token));

      const emailResult = inviteRow.token
        ? await sendTeamInviteEmail({
            inviteToken: inviteRow.token,
          })
        : { success: false };

      if ((emailResult as any).success) {
        toast({
          title: "Success",
          description: "Invitation created and email sent successfully",
        });
      } else {
        toast({
          title: "Invitation Created",
          description: inviteRow.token
            ? "Invitation link created, but email could not be sent. Please share the link manually."
            : "Invitation created, but no link is available to share.",
        });
      }

      setInviteEmail("");
      setInviteRole("manager");
      fetchTeamData();
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

  const handleCopyInviteLink = (token: string | null) => {
    if (!token) {
      toast({ title: "No link available", description: "This invite does not have a token link to copy." });
      return;
    }

    const link = `${globalThis.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied",
      description: "Invite link copied to clipboard",
    });
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelAgencyInvite(inviteId);
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

  const getInviteStatus = (expiresAt: string | null) => {
    if (!expiresAt) return "Pending";
    const now = new Date();
    const expiry = new Date(expiresAt);
    return expiry > now ? "Pending" : "Expired";
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
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
      await updateAgencyMemberRole(memberId, newRole);
      toast({
        title: "Success",
        description: "Member role updated",
      });
      fetchTeamData();
    } catch (error: any) {
      if (error.message?.includes('Multi-admin feature requires Agency Plus plan')) {
        toast({
          title: "Upgrade Required",
          description: "Multi-admin feature requires Agency Plus plan",
          variant: "destructive",
        });
        openUpgradeModal({ feature: 'Multi-admin', suggestedPlan: 'agency_plus' });
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeAgencyMember(memberId);
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
        return "default";
      case "manager":
        return "secondary";
      case "member":
        return "outline";
      default:
        return "outline";
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen ">
        <div className="animate-pulse space-y-6">
          <div className="h-8 "></div>
          <div className="grid grid-cols-3 gap-6">
            <div className="h-32  rounded-lg"></div>
            <div className="h-32  rounded-lg"></div>
            <div className="h-32  rounded-lg"></div>
          </div>
          <div className="h-64  rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!canManageTeam) {
    return (
      <div className="min-h-screen  p-6">
        <div className="flex items-center justify-center h-96">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
              <p className="text-slate-600 mb-4">
                Team management permissions are required to view this page.
              </p>
              <Button onClick={() => navigate("/")}>Return to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className="border-b ">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Building className="h-8 w-8 text-slate-900" />
                <div>
                  <h1 className="text-2xl font-bold  text-white">Team Management</h1>
                  <p className="text-sm text-slate-600">
                    {agencyName} • {teamMembers.length} team members
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setActiveTab("invite")}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Invite Team Member
              </Button>
              <Button 
                onClick={() => openUpgradeModal({ feature: 'Team expansion' })}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Upgrade Team
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Team Overview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-slate-900  text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">Team Members</p>
                  <p className="text-3xl font-bold mt-2">{teamMembers.length}</p>
                </div>
                <Users className="h-10 w-10 text-slate-400" />
              </div>
              <Progress value={teamUtilization} className="mt-4 h-2 bg-slate-700" />
              <p className="text-xs text-slate-400 mt-2">
                {limits?.teamMembers ? `${teamMembers.length} / ${limits.teamMembers} limit` : 'Unlimited'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Active Roles</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      {teamMembers.filter(m => m.role === 'admin').length} Admin
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                      {teamMembers.filter(m => m.role === 'manager').length} Manager
                    </Badge>
                  </div>
                </div>
                <Shield className="h-10 w-10 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Pending Invites</p>
                  <p className="text-3xl font-bold mt-2">{pendingInvites.length}</p>
                </div>
                <Mail className="h-10 w-10 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Plan Status</p>
                  <p className="text-lg font-semibold mt-2 capitalize">{currentUserPlan?.replace('_', ' ') || 'Free'}</p>
                </div>
                <Crown className="h-10 w-10 text-amber-500" />
              </div>
              {isAtLimit && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4"
                  onClick={() => openUpgradeModal({ feature: 'Team limit reached' })}
                >
                  Upgrade to add more
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className=" p-1">
            <TabsTrigger value="members" >
              <Users className="h-4 w-4 mr-2" />
              Team Members
            </TabsTrigger>
            <TabsTrigger value="invite" >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Members
            </TabsTrigger>
            <TabsTrigger value="roles" >
              <UserCog className="h-4 w-4 mr-2" />
              Role Permissions
            </TabsTrigger>
            <TabsTrigger value="analytics" >
              <BarChart3 className="h-4 w-4 mr-2" />
              Team Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            {/* Team Members Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>
                      Manage permissions and roles for your agency team
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <div className="text-center py-12 border rounded-lg">
                    <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Team Members</h3>
                    <p className="text-slate-600 mb-4">Start building your team by inviting members</p>
                    <Button onClick={() => setActiveTab("invite")}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Your First Member
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {teamMembers.map((member) => {
                      const isCurrentUser = member.user_id === user?.id;
                      const isOwnerMember = member.role === "owner";
                      const canEditThisMember = canManageTeam && !isOwnerMember;
                      const canRemoveThisMember = canRemoveTeamMembers && !isOwnerMember && !isCurrentUser;

                      return (
                        <div key={member.id} className="flex items-center justify-between p-4 rounded-lg border hover:text-slate-700 transition-colors">
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarImage src={member.profile?.avatar_url || undefined} />
                              <AvatarFallback className="bg-slate-200 text-slate-700">
                                {getInitials(member.profile?.full_name, member.profile?.email || '')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">
                                  {member.profile?.full_name || "Unnamed User"}
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs font-normal text-slate-500">(You)</span>
                                  )}
                                </p>
                                <Badge variant={getRoleBadgeVariant(member.role)}>
                                  {member.role}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600">{member.profile?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!agencyId || isCurrentUser) return;
                                try {
                                  const memberIds = await getAgencyMemberIdsByUserIds(
                                    agencyId,
                                    [user!.id, member.user_id]
                                  );
                                  if (memberIds.length !== 2) {
                                    toast({
                                      title: "Error",
                                      description: "Failed to find agency member records",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  await createConversation.mutateAsync({
                                    type: "direct",
                                    member_ids: memberIds,
                                  });
                                  navigate("/messages");
                                } catch (error) {
                                  console.error("Error creating conversation:", error);
                                }
                              }}
                              disabled={isCurrentUser}
                              title={isCurrentUser ? "Cannot message yourself" : "Send message"}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            {canEditThisMember && (
                              <Select
                                value={member.role}
                                onValueChange={(value) => handleRoleChange(member.id, value)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLES.map((role) => (
                                    <SelectItem
                                      key={role}
                                      value={role}
                                      disabled={
                                        (role === "admin" && currentUserPlan !== "agency_plus") ||
                                        role === "owner"
                                      }
                                    >
                                      <div className="flex items-center justify-between">
                                        <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                                        {role === "admin" && currentUserPlan !== "agency_plus" && (
                                          <Crown className="h-3 w-3 text-amber-500" />
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {canRemoveThisMember && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMemberToRemove(member.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Invitations</CardTitle>
                  <CardDescription>Invites awaiting acceptance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingInvites.map((invite) => {
                      const status = getInviteStatus(invite.expires_at);
                      const isExpired = status === "Expired";
                      
                      return (
                        <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                              <Mail className="h-5 w-5 text-slate-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{invite.email}</p>
                                <Badge variant={isExpired ? "destructive" : "secondary"}>
                                  {isExpired ? "Expired" : "Pending"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Badge variant="outline">{invite.role}</Badge>
                                <span>•</span>
                                <span>Sent {format(new Date(invite.created_at), 'MMM d')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyInviteLink(invite.token)}
                              disabled={isExpired}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Link
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setInviteToCancel(invite.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="invite" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Invite Team Member</CardTitle>
                  <CardDescription>
                    Add new members to collaborate on client work
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="invite-email">
                        Email Address <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="invite-role">Team Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger id="invite-role" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem
                              key={role}
                              value={role}
                              disabled={role === "admin" && currentUserPlan !== "agency_plus"}
                            >
                              <div className="flex items-center justify-between">
                                <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                                {role === "admin" && currentUserPlan !== "agency_plus" && (
                                  <Badge variant="outline" className="text-xs">
                                    Agency Plus
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-slate-600 mt-2">
                        {ROLE_DESCRIPTIONS[inviteRole as keyof typeof ROLE_DESCRIPTIONS] || "Standard team member permissions"}
                      </p>
                    </div>

                    <PlanGuard feature="teamMembers" requiredPlan="starter">
                      <Button 
                        onClick={handleInvite} 
                        disabled={submitting}
                        className="w-full"
                      >
                        {submitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Sending Invitation...
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                    </PlanGuard>
                  </div>

                  {showInviteLink && (
                    <Card className="bg-slate-50 border-slate-200">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <Label>Invitation Link</Label>
                          <div className="flex gap-2">
                            <Input
                              value={inviteLink}
                              readOnly
                              className="font-mono text-sm bg-white"
                            />
                            <Button
                              variant="outline"
                              onClick={handleCopyLink}
                              className="shrink-0"
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </Button>
                          </div>
                          <p className="text-xs text-slate-500">
                            Share this link with your team member. The link expires in 7 days.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Role Permissions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
                    <div key={role} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{role}</span>
                        {role === 'admin' && currentUserPlan !== 'agency_plus' && (
                          <Badge variant="outline" className="text-xs">
                            Upgrade Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{description}</p>
                      <Separator />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <CardTitle>Role-Based Permissions</CardTitle>
                <CardDescription>Configure access levels for your team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="">
                        <TableHead>Permission</TableHead>
                        <TableHead className="text-center">Owner</TableHead>
                        <TableHead className="text-center">Admin</TableHead>
                        <TableHead className="text-center">Manager</TableHead>
                        <TableHead className="text-center">Member</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { permission: 'Manage Team Members', owner: true, admin: true, manager: false, member: false },
                        { permission: 'Invite New Members', owner: true, admin: true, manager: false, member: false },
                        { permission: 'Manage Client Accounts', owner: true, admin: true, manager: true, member: true },
                        { permission: 'Create & Edit Content', owner: true, admin: true, manager: true, member: true },
                        { permission: 'Approve Content', owner: true, admin: true, manager: true, member: false },
                        { permission: 'Access Billing', owner: true, admin: false, manager: false, member: false },
                        { permission: 'View Analytics', owner: true, admin: true, manager: true, member: true },
                        { permission: 'Export Data', owner: true, admin: true, manager: true, member: false },
                      ].map((row) => (
                        <TableRow key={row.permission}>
                          <TableCell className="font-medium">{row.permission}</TableCell>
                          <TableCell className="text-center">
                            <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto" />
                          </TableCell>
                          <TableCell className="text-center">
                            {row.admin ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-slate-300 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.manager ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-slate-300 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.member ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-slate-300 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Team Analytics</CardTitle>
                <CardDescription>Performance and engagement metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Team Analytics Coming Soon</h3>
                  <p className="text-slate-600">
                    Detailed team performance metrics and engagement analytics will be available soon.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upgrade Banner */}
        {isAtLimit && (
          <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Team Member Limit Reached</h3>
                    <p className="text-emerald-700 mb-2">
                      Upgrade to add unlimited team members and unlock advanced collaboration features.
                    </p>
                    <div className="flex items-center gap-4">
                      <Button 
                        onClick={() => openUpgradeModal({ feature: 'Team expansion' })}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        Upgrade Plan
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-emerald-700">
                        Learn about enterprise plans
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmation Dialogs */}
        <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>This action cannot be undone. The team member will:</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Lose access to all agency clients and content</li>
                  <li>Be removed from all team conversations</li>
                  <li>Need to be re-invited to regain access</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Remove Member
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!inviteToCancel} onOpenChange={() => setInviteToCancel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this invitation? The invite link will become invalid immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Invite</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => inviteToCancel && handleCancelInvite(inviteToCancel)}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Cancel Invitation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}