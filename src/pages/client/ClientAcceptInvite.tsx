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

        setInviteValid(true);
        setInviteEmail(data.email);
        setClientName(data.client_name);
        setPortalSlug(data.portal_slug);
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
    
    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (!token) return;

    setLoading(true);

    try {
      await signup(token, password, fullName);
      toast({
        title: "Welcome!",
        description: "Your account has been created successfully",
      });
      navigate(`/client/portal/${portalSlug}`);
    } catch (error: any) {
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
          <p className="text-muted-foreground">
            This invitation link is invalid or has expired.
          </p>
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
