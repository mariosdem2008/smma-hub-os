import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useClientAuth } from "@/lib/client-auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
      console.log("[client-login] mount", {
        hasSession: !!authUser?.user,
        lookup: authUser?.user ? "portal_user_id" : "slug",
      });

      if (authUser?.user?.id) {
        const { data: client, error } = await supabase
          .from("clients")
          .select("id, name, portal_slug")
          .eq("portal_user_id", authUser.user.id)
          .maybeSingle();

        if (client) {
          const destination = client.portal_slug ? `/client/portal/${client.portal_slug}` : "/client/portal";
          console.log("[client-login] authed client found, navigating:", destination);
          navigate(destination);
          return;
        }

        if (error) {
          console.error("[client-login] portal_user_id lookup failed", error);
        }

        setPortalError("Account not linked to a portal");
      }

      if (portalSlug) {
        // Avoid unauthenticated table/view lookups that can fail under strict RLS.
        // The login edge function resolves and validates portal slug server-side.
        setClientName(portalSlug);
      }

      if (!portalSlug && !authUser?.user?.id) {
        setPortalError("Portal link required");
      }

      setPortalLookupComplete(true);
    };

    bootstrapPortal();
  }, [isAuthenticated, portalSlug, navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: authUser } = await supabase.auth.getUser();
    if (authUser?.user?.id) {
      console.log("[client-login] existing session, using portal_user_id flow");
    }

    if (!portalSlug && !clientId && !authUser?.user) {
      toast({
        title: "Error",
        description: "Client portal slug is required",
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
        const { data: client, error } = await supabase
          .from("clients")
          .select("portal_slug")
          .eq("portal_user_id", userSession.user.id)
          .maybeSingle();

        if (error) {
          console.error("[client-login] portal_user_id lookup after login failed", error);
        }

        if (client?.portal_slug) {
          destination = `/client/portal/${client.portal_slug}`;
        }
      } else if (portalSlug) {
        destination = `/client/portal/${portalSlug}`;
      }

      console.log("[client-login] navigating to portal:", destination);
      navigate(destination);
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePortalSlugSubmit = (e: React.FormEvent) => {
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (portalError === "Portal link required") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold mb-2">Client Portal</h1>
          <p className="text-muted-foreground mb-6">Enter your portal slug from your agency invite link.</p>
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
            <Button type="submit" className="w-full">Continue</Button>
          </form>
        </Card>
      </div>
    );
  }

  if (portalError && !clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">{portalError}</h1>
          <p className="text-muted-foreground">Please contact your agency for assistance.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Client Portal</h1>
          <p className="text-muted-foreground">{clientName}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
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
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>

          <div className="text-center text-sm">
            {portalSlug ? (
              <Link
                to={`/client/forgot-password/${portalSlug}`}
                className="text-primary hover:underline"
              >
                Forgot password?
              </Link>
            ) : (
              <span className="text-muted-foreground">Forgot password is available after portal slug selection.</span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
