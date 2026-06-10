import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ClientForgotPassword() {
  const { portalSlug } = useParams();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resolvingPortal, setResolvingPortal] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    const fetchClient = async () => {
      if (!portalSlug) {
        setPortalError("Portal link required");
        setResolvingPortal(false);
        return;
      }

      const { data } = await supabase
        .from("portal_public_clients")
        .select("id, name")
        .eq("portal_slug", portalSlug)
        .eq("portal_enabled", true)
        .maybeSingle();

      if (data) {
        setClientId(data.id);
        setClientName(data.name);
        setPortalError(null);
      } else {
        setPortalError("Client portal not found");
      }
      setResolvingPortal(false);
    };

    fetchClient();
  }, [portalSlug]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      toast({
        title: "Client portal not found",
        description: "Use the portal link from your agency invite.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, client_id: clientId }),
      });

      if (!response.ok) {
        throw new Error("Failed to send reset email");
      }

      setSent(true);
      toast({
        title: "Reset email sent",
        description: "If an account exists, a reset link will arrive shortly.",
      });
    } catch {
      toast({
        title: "Reset email failed",
        description: "Please try again or contact your agency.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (resolvingPortal) {
    return (
      <AuthShell mode="client" eyebrow="Client portal" title="Checking portal access." description="This takes a moment.">
        <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/40 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Resolving portal
        </div>
      </AuthShell>
    );
  }

  if (portalError || !clientId) {
    return (
      <AuthShell
        mode="client"
        eyebrow="Client portal"
        title={portalError ?? "Client portal not found"}
        description="Please use your agency invite link or contact your agency."
      >
        {portalSlug ? (
          <Button asChild variant="outline" className="w-full">
            <Link to={`/client/login/${portalSlug}`}>Back to sign in</Link>
          </Button>
        ) : null}
      </AuthShell>
    );
  }

  if (sent) {
    return (
      <AuthShell
        mode="client"
        eyebrow="Password reset"
        title="Check your email."
        description={`If an account exists with ${email}, a reset link will arrive shortly.`}
      >
        <Button asChild variant="outline" className="w-full">
          <Link to={`/client/login/${portalSlug}`}>Back to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="client"
      eyebrow="Password reset"
      title="Recover client portal access."
      description={clientName ? `Portal: ${clientName}` : "Enter your email to receive a secure reset link."}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@company.com"
            required
            autoComplete="email"
          />
        </div>

        <Button type="submit" className="w-full" loading={loading}>
          <Mail className="h-4 w-4" />
          Send reset link
        </Button>

        <div className="text-center text-sm">
          <Link to={`/client/login/${portalSlug}`} className="text-primary hover:text-primary-hover hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
