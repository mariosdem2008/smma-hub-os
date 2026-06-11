import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/lib/client-auth";

export default function ClientLogin() {
  const { portalSlug } = useParams();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useClientAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalSlugInput, setPortalSlugInput] = useState(portalSlug ?? "");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [portalLookupComplete, setPortalLookupComplete] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrapPortal = async () => {
      const { data: authUser } = await supabase.auth.getUser();

      if (authUser?.user?.id) {
        const { data: client, error } = await supabase
          .from("clients")
          .select("id, name, portal_slug")
          .eq("portal_user_id", authUser.user.id)
          .maybeSingle();

        if (client) {
          const destination = client.portal_slug ? `/client/portal/${client.portal_slug}` : "/client/portal";
          navigate(destination);
          return;
        }

        if (error) {
          setPortalError("Account not linked to a portal");
        }

        setPortalError("Account not linked to a portal");
      }

      if (portalSlug) {
        setClientName(portalSlug);
      }

      if (!portalSlug && !authUser?.user?.id) {
        setPortalError("Portal link required");
      }

      setPortalLookupComplete(true);
    };

    bootstrapPortal();
  }, [isAuthenticated, portalSlug, navigate, toast]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const { data: authUser } = await supabase.auth.getUser();

    if (!portalSlug && !clientId && !authUser?.user) {
      toast({
        title: "Portal slug required",
        description: "Use the portal link from your agency invite.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await login(email, password, { clientId: clientId ?? undefined, portalSlug: portalSlug ?? undefined });

      const { data: userSession } = await supabase.auth.getUser();
      let destination = "/client/portal";

      if (userSession?.user?.id) {
        const { data: client } = await supabase
          .from("clients")
          .select("portal_slug")
          .eq("portal_user_id", userSession.user.id)
          .maybeSingle();

        if (client?.portal_slug) {
          destination = `/client/portal/${client.portal_slug}`;
        }
      } else if (portalSlug) {
        destination = `/client/portal/${portalSlug}`;
      }

      navigate(destination);
    } catch (error: any) {
      toast({
        title: "Client sign in failed",
        description: error.message || "Check your email and password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePortalSlugSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalized = portalSlugInput.trim().replace(/^\/+|\/+$/g, "");
    if (!normalized) {
      toast({
        title: "Portal slug required",
        description: "Enter your client portal slug to continue.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/client/login/${normalized}`);
  };

  if (!portalLookupComplete && !clientId && !portalError) {
    return (
      <AuthShell eyebrow="Client portal" title="Opening your portal." description="We are checking your access.">
        <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/40 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Preparing secure client access
        </div>
      </AuthShell>
    );
  }

  if (portalError === "Portal link required") {
    return (
      <AuthShell
        mode="client"
        eyebrow="Client portal"
        title="Enter your portal link."
        description="Use the portal slug from your agency invite to continue."
      >
        <form onSubmit={handlePortalSlugSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portalSlug">Portal slug</Label>
            <Input
              id="portalSlug"
              value={portalSlugInput}
              onChange={(e) => setPortalSlugInput(e.target.value)}
              placeholder="your-company"
              autoComplete="off"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </AuthShell>
    );
  }

  if (portalError && !clientId) {
    return (
      <AuthShell
        mode="client"
        eyebrow="Client portal"
        title={portalError}
        description="Please contact your agency for access help."
      >
        <div className="rounded-lg border border-border/80 bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Your agency can resend the portal invite.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      mode="client"
      eyebrow="Client portal"
      title="Sign in to your client workspace."
      description={clientName ? `Portal: ${clientName}` : "Review approvals, messages, assets, and campaign progress."}
    >
      <form onSubmit={handleLogin} className="space-y-4">
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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>

        <div className="text-center text-sm">
          {portalSlug ? (
            <Link to={`/client/forgot-password/${portalSlug}`} className="focus-ring rounded-md text-primary hover:text-primary-hover hover:underline">
              Forgot password?
            </Link>
          ) : (
            <span className="text-muted-foreground">Password reset is available after portal selection.</span>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
