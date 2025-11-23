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
  const [portalEnabled, setPortalEnabled] = useState<boolean | null>(null);
  const [clientName, setClientName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    checkPortalStatus();
  }, [portalSlug]);

  useEffect(() => {
    // If already logged in, check access and redirect
    if (user && portalEnabled) {
      checkAccessAndRedirect();
    }
  }, [user, portalEnabled]);

  const checkPortalStatus = async () => {
    if (!portalSlug) return;

    const { data: client } = await supabase
      .from("clients")
      .select("portal_enabled, name")
      .eq("portal_slug", portalSlug)
      .maybeSingle();

    if (client) {
      setPortalEnabled(client.portal_enabled);
      setClientName(client.name);
    } else {
      setPortalEnabled(false);
    }
  };

  const checkAccessAndRedirect = async () => {
    if (!user || !portalSlug) return;

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("portal_slug", portalSlug)
      .single();

    if (client) {
      const { data: portalUser } = await supabase
        .from("client_portal_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("client_id", client.id)
        .maybeSingle();

      if (portalUser) {
        navigate(`/client-portal/${portalSlug}`);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Login failed");

      // Verify portal exists and is enabled
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, portal_enabled")
        .eq("portal_slug", portalSlug)
        .single();

      if (clientError || !client) throw new Error("Portal not found");
      if (!client.portal_enabled) throw new Error("This portal is not enabled");

      // Auto-grant access by creating portal user entry if not exists
      const { data: existingAccess } = await supabase
        .from("client_portal_users")
        .select("id")
        .eq("client_id", client.id)
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!existingAccess) {
        await supabase
          .from("client_portal_users")
          .insert({
            client_id: client.id,
            user_id: data.user.id,
            email: normalizedEmail,
            role: "client_viewer",
          });
      }

      toast({ title: "Welcome back!", description: "Logging you in..." });

      setTimeout(() => {
        navigate(`/client-portal/${portalSlug}`);
      }, 500);
    } catch (error: any) {
      console.error("Login error:", error);
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
      const normalizedEmail = email.toLowerCase().trim();

      // Verify portal exists and is enabled
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, portal_enabled")
        .eq("portal_slug", portalSlug)
        .single();

      if (clientError || !client) throw new Error("Portal not found");
      if (!client.portal_enabled) throw new Error("This portal is not enabled");

      // Create auth account
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

      // Auto-grant portal access
      await supabase
        .from("client_portal_users")
        .insert({
          client_id: client.id,
          user_id: authData.user.id,
          email: normalizedEmail,
          name: fullName,
          role: "client_viewer",
        });

      toast({
        title: "Welcome!",
        description: "Your account has been created successfully.",
      });

      setTimeout(() => {
        navigate(`/client-portal/${portalSlug}`);
      }, 1000);
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "An error occurred during signup",
        variant: "destructive",
      });
      setLoading(false);
    }
  };


  if (portalEnabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (portalEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Portal Not Available</h1>
          <p className="text-muted-foreground">
            This client portal is not currently enabled. Please contact your agency for access.
          </p>
        </Card>
      </div>
    );
  }

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
                Anyone with this portal link can create an account
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
