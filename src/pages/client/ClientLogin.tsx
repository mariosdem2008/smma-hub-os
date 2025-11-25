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
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (isAuthenticated && portalSlug) {
      navigate(`/client/portal/${portalSlug}`);
    }
  }, [isAuthenticated, portalSlug, navigate]);

  useEffect(() => {
    const fetchClient = async () => {
      if (!portalSlug) return;
      
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("portal_slug", portalSlug)
        .eq("portal_enabled", true)
        .single();

      if (data) {
        setClientId(data.id);
        setClientName(data.name);
      } else {
        toast({
          title: "Portal Not Found",
          description: "This client portal does not exist.",
          variant: "destructive",
        });
      }
    };

    fetchClient();
  }, [portalSlug, toast]);

  const handleLogin = async (e: React.FormEvent) => {
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
      await login(email, password, clientId);
      navigate(`/client/portal/${portalSlug}`);
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

  if (!clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <Link
              to={`/client/forgot-password/${portalSlug}`}
              className="text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
