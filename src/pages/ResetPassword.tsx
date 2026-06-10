import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setTokenValid(true);
      } else {
        setTokenValid(false);
        toast({
          title: "Reset link expired",
          description: "Request a new password reset link to continue.",
          variant: "destructive",
        });
      }
      setValidating(false);
    };

    checkSession();
  }, [toast]);

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Enter the same password in both fields.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password is too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      toast({
        title: "Password reset",
        description: "Your workspace password has been updated.",
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Password reset failed",
        description: error.message || "We could not update your password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <AuthShell eyebrow="Password reset" title="Checking your reset link." description="This takes a moment.">
        <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/40 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Validating secure session
        </div>
      </AuthShell>
    );
  }

  if (!tokenValid) {
    return (
      <AuthShell
        eyebrow="Password reset"
        title="This reset link is no longer valid."
        description="Request a fresh link and return here from your email."
      >
        <Button type="button" className="w-full" onClick={() => navigate("/forgot-password")}>
          Request new reset link
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Set a new password."
      description="Choose a password that protects agency and client work."
    >
      <form onSubmit={handleReset} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          <Lock className="h-4 w-4" />
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
