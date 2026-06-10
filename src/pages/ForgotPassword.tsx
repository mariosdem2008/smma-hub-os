import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ForgotPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const resetUrl = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: "Reset email sent",
        description: "Check your inbox for the password reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Reset email failed",
        description: error.message || "We could not send the reset email.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        eyebrow="Password reset"
        title="Check your email."
        description={`We sent a password reset link to ${email}.`}
      >
        <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/auth")}>
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Recover access to your workspace."
      description="Enter your email and we will send a secure reset link."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="owner@agency.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            autoComplete="email"
          />
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          <Mail className="h-4 w-4" />
          Send reset link
        </Button>
        <Button type="button" variant="link" className="w-full" onClick={() => navigate("/auth")} disabled={loading}>
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Button>
      </form>
    </AuthShell>
  );
}
