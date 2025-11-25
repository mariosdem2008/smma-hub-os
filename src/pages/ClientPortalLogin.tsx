import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

export function ClientPortalLogin() {
  const { portalSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    checkPortalStatus();
  }, [portalSlug]);

  useEffect(() => {
    // If already logged in, check access and redirect
    if (user) {
      checkAccessAndRedirect();
    }
  }, [user]);

  const checkPortalStatus = async () => {
    if (!portalSlug) return;

    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("portal_slug", portalSlug)
      .maybeSingle();

    if (client) {
      setClientName(client.name);
    }
  };

  const checkAccessAndRedirect = async () => {
    if (!user || !portalSlug) return;

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("portal_slug", portalSlug)
      .single();

    if (!client) return;

    // Use secure function to check invitation (checks by email OR user_id)
    const { data: invitationData } = await supabase.rpc('check_portal_invitation', {
      _client_id: client.id,
      _email: user.email || ''
    });

    const invitation = invitationData?.[0];
    
    if (invitation) {
      navigate(`/client-portal/${portalSlug}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          throw new Error("Please verify your email before logging in. Check your inbox for the verification link.");
        }
        throw error;
      }
      
      if (!data.user) throw new Error("Login failed");

      // Get the client by portal slug (uses public RLS policy)
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("portal_slug", portalSlug)
        .eq("portal_enabled", true)
        .maybeSingle();

      if (clientError || !client) {
        await supabase.auth.signOut();
        throw new Error("Portal not found or unavailable");
      }

      // Check if user has a valid invitation for THIS portal using secure function
      const { data: invitationData } = await supabase.rpc('check_portal_invitation', {
        _client_id: client.id,
        _email: normalizedEmail
      });

      const invitation = invitationData && invitationData.length > 0 ? invitationData[0] : null;

      // If no invitation exists, deny access
      if (!invitation) {
        await supabase.auth.signOut();
        throw new Error("You don't have access to this portal. Please contact your agency for an invitation.");
      }

      // If invitation exists but not linked to user, link it using secure function
      if (!invitation.user_id) {
        const { data: linked, error: linkError } = await supabase.rpc('accept_portal_invitation', {
          _invitation_id: invitation.id
        });
        
        if (linkError || !linked) {
          console.error("Failed to link invitation:", linkError);
          // Continue anyway - the invitation exists, they should still be able to access
        }
      }

      toast({ title: "Welcome back!" });
      
      // Explicitly navigate after successful login
      navigate(`/client-portal/${portalSlug}`);
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
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
      const normalizedEmail = email.toLowerCase().trim();

      // Get client by portal slug (now works with public RLS policy)
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, name")
        .eq("portal_slug", portalSlug)
        .eq("portal_enabled", true)
        .maybeSingle();

      if (clientError) {
        console.error("Client lookup error:", clientError);
        throw new Error("Unable to verify portal. Please try again.");
      }

      if (!client) {
        throw new Error("This portal is not available. Please check the URL or contact your agency.");
      }

      // Check for invitation using secure function
      const { data: invitationData, error: invitationError } = await supabase.rpc('check_portal_invitation', {
        _client_id: client.id,
        _email: normalizedEmail
      });

      if (invitationError) {
        console.error("Invitation check error:", invitationError);
        throw new Error("Unable to verify invitation. Please try again.");
      }

      const invitation = invitationData && invitationData.length > 0 ? invitationData[0] : null;

      // Reject signup if no invitation exists
      if (!invitation) {
        throw new Error("You need an invitation to access this portal. Please contact your agency for an invitation.");
      }

      // Check if invitation expired
      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        throw new Error("Your invitation has expired. Please request a new one from your agency.");
      }

      // Create account with email verification
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/client-portal/${portalSlug}`,
          data: { full_name: fullName },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Failed to create account");

      // Link user to invitation
      const { error: updateError } = await supabase
        .from("client_portal_users")
        .update({ 
          user_id: authData.user.id,
          name: fullName,
          accepted_at: new Date().toISOString()
        })
        .eq("id", invitation.id);

      if (updateError) {
        console.error("Failed to link invitation:", updateError);
      }

      // Check if email confirmation is required
      if (authData.session) {
        // Auto-confirm is enabled, user is logged in immediately
        toast({ 
          title: "Welcome!", 
          description: "Your account has been created successfully." 
        });
        navigate(`/client-portal/${portalSlug}`);
      } else {
        // Email confirmation required
        toast({ 
          title: "Verify your email", 
          description: "Please check your email and click the verification link to complete your registration.",
          duration: 6000,
        });
        setMode("login");
        setLoading(false);
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Client Portal</h1>
          {clientName && (
            <p className="text-muted-foreground">{clientName}</p>
          )}
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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

              <p className="text-xs text-muted-foreground text-center">
                You need an invitation to access this portal
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-semibold">SMMAHUB</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
