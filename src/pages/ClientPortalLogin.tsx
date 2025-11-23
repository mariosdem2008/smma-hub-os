import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

export function ClientPortalLogin() {
  const { portalSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState<boolean | null>(null);
  const [clientName, setClientName] = useState("");

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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // The redirect will happen via the useEffect
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
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

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
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

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-semibold">SMMAHUB</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
