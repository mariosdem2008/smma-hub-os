import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useClientAuth } from "@/lib/client-auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function ClientAcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signup } = useClientAuth();
  const { toast } = useToast();
  
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [portalSlug, setPortalSlug] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    const validateInvite = async () => {
      if (!token) {
        toast({
          title: "Invalid Invitation",
          description: "No invitation token provided",
          variant: "destructive",
        });
        setValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          "client-auth-validate-invite",
          { body: { invite_token: token } }
        );

        if (error || !data) {
          throw error || new Error("Invalid invitation");
        }

        // Check if invite was already accepted
        if (data.already_accepted) {
          if (data.portal_slug) {
            setPortalSlug(data.portal_slug);
          }
          setInviteValid(false);
          toast({
            title: "Invitation Already Used",
            description: "This invitation has already been accepted. Please log in.",
          });
          return;
        }

        setInviteValid(true);
        setInviteEmail(data.email);
        setClientName(data.client_name);
        setClientId(data.client_id || null);
        if (data.portal_slug) {
          setPortalSlug(data.portal_slug);
        }
        setFullName(data.full_name || "");
      } catch (err) {
        console.error("Invite validation failed", err);
        toast({
          title: "Invalid Invitation",
          description: "This invitation is invalid or has expired",
          variant: "destructive",
        });
        setInviteValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateInvite();
  }, [token, toast]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("handleSignup called");
    
    if (password !== confirmPassword) {
      console.log("Password mismatch");
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      console.log("No token");
      return;
    }

    console.log("Starting signup with token:", token.substring(0, 10));
    setLoading(true);

    try {
      console.log("Calling signup function");
      const signupResult = await signup(token, password, fullName);
      console.log("Signup successful");
      console.log("[client-accept] signup returned portal_slug:", signupResult.portalSlug);

      let finalSlug = signupResult.portalSlug || "";

      if (!finalSlug && signupResult.clientId) {
        const { data: client, error } = await supabase
          .from("clients")
          .select("portal_slug")
          .eq("id", signupResult.clientId)
          .single();

        if (error) {
          throw error;
        }

        finalSlug = client?.portal_slug || "";
      }

      toast({
        title: "Welcome!",
        description: "Your account has been created successfully",
      });

      const destinationPath = finalSlug ? `/client/portal/${finalSlug}` : "/client/portal";
      console.log("[client-accept] navigating to portal:", destinationPath);
      navigate(destinationPath);
    } catch (error: any) {
      console.error("Signup error:", error);

      const message = error?.message || "";
      if (message.includes("User already exists")) {
        toast({
          title: "Account already exists",
          description: "Please log in with your existing account.",
        });
        navigate(portalSlug ? `/client/login/${portalSlug}` : "/client/login");
        return;
      }

      toast({
        title: "Signup Failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!inviteValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invitation</h1>
          <p className="text-muted-foreground mb-6">
            This invitation link is invalid or has expired.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            If you already have an account, please use the login page.
          </p>
          <Button
            onClick={() => navigate(portalSlug ? `/client/login/${portalSlug}` : "/client/login")}
            variant="default"
            className="w-full"
          >
            {portalSlug ? "Go to Login" : "Contact your agency"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Welcome to {clientName}</h1>
          <p className="text-muted-foreground">Create your portal account</p>
          <p className="text-sm text-muted-foreground mt-2">{inviteEmail}</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </form>
      </Card>
    </div>
  );
}
