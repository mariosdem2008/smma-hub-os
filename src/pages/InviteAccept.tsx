import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, Users } from "lucide-react";
import { acceptAgencyInvite } from "@/lib/agency-invites";
import { getUserAgencyBootstrap } from "@/lib/bootstrap";
import { setActiveAgencyId } from "@/lib/active-agency";

interface Invite {
  invite_id: string;
  agency_id: string;
  email: string;
  role: string;
  expires_at: string | null;
  accepted: boolean;
  declined: boolean;
  agency_name: string | null;
}

export default function InviteAccept() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchInvite();
  }, [token]);

  const fetchInvite = async () => {
    if (!token) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }

    try {
      // Use secure function to fetch invite - prevents email harvesting
      const { data, error } = await supabase.rpc('get_agency_invite_by_token', {
        _token: token
      });

      if (error || !data || data.length === 0) {
        setError("Invite not found or expired");
        setLoading(false);
        return;
      }

      const inviteData = (data as any)[0] as Invite;

      const expired = inviteData.expires_at ? new Date(inviteData.expires_at) <= new Date() : false;
      if (inviteData.accepted) {
        setError("accepted");
      } else if (inviteData.declined) {
        setError("declined");
      } else if (expired) {
        setError("expired");
      } else {
        setInvite({ ...inviteData, agency_name: inviteData.agency_name || null });
      }
    } catch (err: any) {
      console.error("Error fetching invite:", err);
      setError("Failed to load invite");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAgency = async () => {
    if (!invite || !user) return;

    setJoining(true);
    try {
      const agencyId = await acceptAgencyInvite(invite.invite_id);

      const bootstrap = await getUserAgencyBootstrap();
      const memberships = bootstrap.memberships ?? [];
      const uniq = Array.from(new Set(memberships.map((m) => m.agency_id))).map(
        (agency_id) => memberships.find((m) => m.agency_id === agency_id)!,
      );

      toast({
        title: "Success",
        description: "You have joined the agency successfully!",
      });

      if (uniq.length > 1) {
        if (agencyId) setActiveAgencyId(agencyId);
        navigate("/select-agency", { replace: true });
        return;
      }
      if (uniq.length === 1) {
        setActiveAgencyId(uniq[0].agency_id);
        navigate("/dashboard", { replace: true });
        return;
      }

      navigate("/bootstrap", { replace: true });
    } catch (error: any) {
      const message = error?.message ?? String(error);
      if (message.includes("email_mismatch")) {
        setError("email_mismatch");
        return;
      }
      toast({
        title: "Error",
        description: message || "Failed to join agency",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "manager":
        return "secondary";
      case "member":
        return "outline";
      // Back-compat display for older roles
      case "creator":
      case "viewer":
        return "outline";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error states
  if (error === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <Clock className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invite Expired</CardTitle>
            <CardDescription>
              This invitation link has expired and can no longer be used.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Please contact the agency owner to request a new invitation.
            </p>
            <Button onClick={() => navigate("/dashboard")} variant="outline">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Already Accepted</CardTitle>
            <CardDescription>
              This invitation has already been accepted.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error === "declined") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invite Declined</CardTitle>
            <CardDescription>This invitation was declined and can no longer be used.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/welcome")} variant="outline">
              Go to Welcome
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((error === "email_mismatch" || (invite && user && invite.email && user.email && invite.email.toLowerCase() !== user.email.toLowerCase()))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Email Mismatch</CardTitle>
            <CardDescription>
              You must sign in with the invited email ({invite?.email}). You are currently signed in as ({user?.email}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                sessionStorage.setItem("redirectUrl", `/invite/${token}`);
                navigate("/auth");
              }}
            >
              Sign out and sign in with {invite?.email}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invalid Invite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/dashboard")} variant="outline">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  // User not signed in
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">You're Invited!</CardTitle>
            <CardDescription>
              Join {invite.agency_name || "the agency"} as a {invite.role}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Agency</span>
                <span className="text-sm text-muted-foreground">
                  {invite.agency_name || "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Role</span>
                <Badge variant={getRoleBadgeVariant(invite.role)}>
                  {invite.role}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email</span>
                <span className="text-sm text-muted-foreground">{invite.email}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-center text-muted-foreground mb-4">
                Sign in or create an account to accept this invitation
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  sessionStorage.setItem("redirectUrl", `/invite/${token}`);
                  navigate("/auth");
                }}
              >
                Sign In
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  sessionStorage.setItem("redirectUrl", `/invite/${token}`);
                  navigate("/auth");
                }}
              >
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is signed in
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Agency</CardTitle>
          <CardDescription>
            You've been invited to join {invite.agency_name || "this agency"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Agency Name</span>
              <span className="text-sm text-muted-foreground">
                {invite.agency_name || "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Role</span>
              <Badge variant={getRoleBadgeVariant(invite.role)}>
                {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Invited Email</span>
              <span className="text-sm text-muted-foreground">{invite.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Your Email</span>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleJoinAgency}
            disabled={joining}
          >
            {joining ? "Joining..." : "Join Agency"}
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/dashboard")}
            disabled={joining}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
