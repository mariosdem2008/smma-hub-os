import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
      
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("portal_slug", portalSlug)
        .eq("portal_enabled", true)
        .maybeSingle();

      if (data) {
        setClientId(data.id);
        setClientName(data.name);
        setPortalError(null);
      } else {
        if (error) {
          console.error("[client-forgot-password] portal slug lookup failed", error);
        }
        setPortalError("Client portal not found");
      }
      setResolvingPortal(false);
    };

    fetchClient();
  }, [portalSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) {
      toast({
        title: "Error",
        description: "Client portal not found",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, client_id: clientId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send reset email");
      }

      setSent(true);
      toast({
        title: "Email Sent",
        description: "If an account exists, you will receive a password reset email",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (resolvingPortal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (portalError || !clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">{portalError ?? "Client portal not found"}</h1>
          <p className="text-muted-foreground mb-6">Please use your agency invite link or contact your agency.</p>
          {portalSlug ? (
            <Link to={`/client/login/${portalSlug}`}>
              <Button variant="outline" className="w-full">Back to Login</Button>
            </Link>
          ) : null}
        </Card>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
          <p className="text-muted-foreground mb-6">
            If an account exists with {email}, you will receive a password reset link shortly.
          </p>
          <Link to={`/client/login/${portalSlug}`}>
            <Button variant="outline" className="w-full">
              Back to Login
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
          <p className="text-muted-foreground">{clientName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>

          <div className="text-center text-sm">
            <Link
              to={`/client/login/${portalSlug}`}
              className="text-primary hover:underline"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
