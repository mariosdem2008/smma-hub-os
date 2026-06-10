import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ClientResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [validating, setValidating] = useState(true);

  const token = searchParams.get("token");

  useEffect(() => {
    setTokenValid(Boolean(token));
    setValidating(false);
  }, [token]);

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

    if (!token) return;

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        credentials: "include",
        body: JSON.stringify({ reset_token: token, new_password: password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }

      const { user } = await response.json();

      toast({
        title: "Password reset",
        description: "Your client portal password has been updated.",
      });

      navigate(`/client/portal/${user.client_id}`);
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
      <AuthShell mode="client" eyebrow="Password reset" title="Checking your reset link." description="This takes a moment.">
        <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/40 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Validating secure token
        </div>
      </AuthShell>
    );
  }

  if (!tokenValid) {
    return (
      <AuthShell
        mode="client"
        eyebrow="Password reset"
        title="This reset link is no longer valid."
        description="Ask your agency for a fresh reset link."
      >
        <div className="rounded-lg border border-border/80 bg-muted/40 p-4 text-sm text-muted-foreground">
          The token is missing or expired.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="client"
      eyebrow="Password reset"
      title="Set a new client portal password."
      description="Choose a password that protects approvals, messages, and shared assets."
    >
      <form onSubmit={handleReset} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            minLength={8}
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
