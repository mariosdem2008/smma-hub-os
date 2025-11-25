import { useParams, Link, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/lib/client-auth";
import { useClientFonts } from "@/hooks/useClientFonts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  LogOut,
  CalendarDays,
  CheckCircle,
  Upload,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  primary_font: string | null;
  secondary_font: string | null;
  brand_colors: any;
  website: string | null;
  notes: string | null;
  niche: string | null;
  tone_of_voice: string | null;
  agency_id: string;
}

const navItems = [
  { path: "approvals", label: "Approvals", key: "approvals", icon: CheckCircle },
  { path: "content-calendar", label: "Calendar", key: "content_calendar", icon: CalendarDays },
  { path: "assets", label: "Assets", key: "assets", icon: FolderOpen },
  { path: "uploads", label: "Upload", key: "uploads", icon: Upload },
];

function ClientPortalLayoutContent() {
  const { portalSlug } = useParams();
  const navigate = useNavigate();
  const { clientUser, logout, loading, isAuthenticated } = useClientAuth();
  const [client, setClient] = useState<Client | null>(null);

  // Load fonts dynamically
  useClientFonts({
    primaryFont: client?.primary_font,
    secondaryFont: client?.secondary_font,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate(`/client/login/${portalSlug}`);
    }
  }, [loading, isAuthenticated, navigate, portalSlug]);

  useEffect(() => {
    if (clientUser?.client_id) {
      fetchClient();
    }
  }, [clientUser]);

  const fetchClient = async () => {
    if (!clientUser?.client_id) return;

    const { data } = await supabase
      .from("client_portal_view")
      .select("*")
      .eq("id", clientUser.client_id)
      .maybeSingle();

    if (data) {
      setClient({
        ...data,
        brand_colors: Array.isArray(data.brand_colors) 
          ? data.brand_colors 
          : data.brand_colors,
      });
    }
  };

  const handleSignOut = () => {
    logout();
    navigate(`/client/login/${portalSlug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading portal...</div>
      </div>
    );
  }

  if (!isAuthenticated || !clientUser || !client) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {client.logo_url && (
              <img
                src={client.logo_url}
                alt={client.name}
                className="h-10 w-10 object-contain"
              />
            )}
            <div>
              <h1 className="text-xl font-semibold">{client.name}</h1>
              <p className="text-xs text-muted-foreground">Client Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {clientUser.full_name || clientUser.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container flex px-6 py-6">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 pr-6">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                window.location.pathname ===
                `/client/portal/${portalSlug}${item.path ? `/${item.path}` : ""}`;

              return (
                <Link
                  key={item.path}
                  to={`/client/portal/${portalSlug}${item.path ? `/${item.path}` : ""}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <Outlet context={{ client, clientId: clientUser.client_id, clientUser }} />
        </main>
      </div>
    </div>
  );
}

export function ClientPortalLayout() {
  return <ClientPortalLayoutContent />;
}
