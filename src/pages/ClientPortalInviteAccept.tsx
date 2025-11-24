import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle } from "lucide-react";

export function ClientPortalInviteAccept() {
  const { portalSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const token = searchParams.get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invitationValid, setInvitationValid] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [mode, setMode] = useState<"login" | "signup">("signup");

  useEffect(() => {
    validateInvitation();
  }, [token, portalSlug]);

  useEffect(() => {
    // If user is already logged in and invitation is valid, auto-accept
    if (user && invitationValid && invitationData) {
      acceptInvitation();
    }
  }, [user, invitationValid, invitationData]);

  const validateInvitation = async () => {
    if (!token || !portalSlug) {
      setValidating(false);
      return;
    }

    try {
      // Get client by portal slug
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, portal_enabled")
        .eq("portal_slug", portalSlug)
        .single();

      if (!client || !client.portal_enabled) {
        setInvitationValid(false);
        setValidating(false);
        return;
      }

      // Check invitation token
      const { data: invitation, error } = await supabase
        .from("client_portal_users")
        .select("id, email, client_id, expires_at, accepted_at, user_id")
        .eq("invite_token", token)
        .eq("client_id", client.id)
        .maybeSingle();

      if (error || !invitation) {
        setInvitationValid(false);
        setValidating(false);
        return;
      }

      // Check if already accepted
      if (invitation.accepted_at) {
        toast({
          title: "Invitation Already Accepted",
          description: "This invitation has already been used.",
          variant: "destructive",
        });
        setInvitationValid(false);
        setValidating(false);
        return;
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        toast({
          title: "Invitation Expired",
          description: "This invitation has expired. Please request a new one.",
          variant: "destructive",
        });
        setInvitationValid(false);
        setValidating(false);
        return;
      }

      setEmail(invitation.email);
      setInvitationData({ ...invitation, clientName: client.name });
      setInvitationValid(true);
    } catch (error) {
      console.error("Error validating invitation:", error);
      setInvitationValid(false);
    } finally {
      setValidating(false);
    }
  };

  const acceptInvitation = async () => {
    if (!user || !invitationData) return;

    try {
      // Link user to invitation
      const { error } = await supabase
        .from("client_portal_users")
        .update({ 
          user_id: user.id,
          accepted_at: new Date().toISOString()
        })
        .eq("id", invitationData.id);

      if (error) throw error;

      toast({
        title: "Welcome!",
        description: "Your invitation has been accepted.",
      });

      setTimeout(() => {
        navigate(`/client-portal/${portalSlug}`);
      }, 500);
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error("Login failed");

      // Auto-accept will trigger via useEffect
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/client-portal/${portalSlug}`,
          data: { full_name: fullName },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Failed to create account");

      // Auto-accept will trigger via useEffect
    } catch (error: any) {
      toast({
        title: "Signup Failed",
        description: error.message || "An error occurred during signup",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Validating invitation...</div>
      </div>
    );
  }

  if (!invitationValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Invalid Invitation</h1>
          <p className="text-muted-foreground mb-6">
            This invitation link is invalid, expired, or has already been used.
            Please contact your agency for a new invitation.
          </p>
          <Button onClick={() => navigate("/")}>
            Go to Homepage
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">You're Invited!</h1>
          <p className="text-muted-foreground">
            Complete your registration to access <strong>{invitationData.clientName}</strong> portal
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="login">Login</TabsTrigger>
          </TabsList>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
