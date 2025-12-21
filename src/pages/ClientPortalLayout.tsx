import { useParams, Link, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/lib/client-auth";
import { useClientFonts } from "@/hooks/useClientFonts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ClientPortalMobileBottomNav } from "@/components/ClientPortalMobileBottomNav";
import { ClientPortalNotificationCenter } from "@/components/notifications/ClientPortalNotificationCenter";
import { Card } from "@/components/ui/card";
import {
  FolderOpen,
  LogOut,
  CalendarDays,
  CheckCircle,
  //  Upload,
  MessageSquare,
  BarChart3,
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
  { path: "performance", label: "Performance", key: "performance", icon: BarChart3 },
  { path: "messages", label: "Messages", key: "messages", icon: MessageSquare },
  { path: "assets", label: "Assets", key: "assets", icon: FolderOpen },
  //  { path: "uploads", label: "Upload", key: "uploads", icon: Upload },
  {
    path: "social-profiles",
    label: "Social Profiles",
    key: "social_profiles",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
];

function ClientPortalLayoutContent() {
  const { portalSlug } = useParams();
  const navigate = useNavigate();
  const { logout } = useClientAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [resolvedPortalSlug, setResolvedPortalSlug] = useState<string | null>(portalSlug || null);
  const isMobile = useIsMobile();

  // Load fonts dynamically
  useClientFonts({
    primaryFont: client?.primary_font,
    secondaryFont: client?.secondary_font,
  });

  useEffect(() => {
    const bootstrap = async () => {
      const { data: authUser } = await supabase.auth.getUser();
      console.log("[client-portal] mount", {
        hasSession: !!authUser?.user,
        lookup: authUser?.user ? "portal_user_id" : "slug",
      });

      if (!authUser?.user) {
        navigate(portalSlug ? `/client/login/${portalSlug}` : "/client/login");
        setPortalLoading(false);
        return;
      }

      const { data, error } = await (supabase.from("clients") as any)
        .select(
          "id,name,logo_url,primary_font,secondary_font,brand_colors,website,notes,niche,tone_of_voice,agency_id,portal_slug",
        )
        .eq("portal_user_id", authUser.user.id)
        .single();

      if (error) {
        console.error("[client-portal] portal_user_id lookup failed", error);
      }

      if (data) {
        setResolvedPortalSlug(data.portal_slug || null);
        setClient({
          ...data,
          brand_colors: Array.isArray(data.brand_colors) ? data.brand_colors : data.brand_colors,
        });
      } else {
        setNotLinked(true);
      }

      setPortalLoading(false);
    };

    bootstrap();
  }, [portalSlug, navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[client-portal] supabase signOut failed", err);
    }
    logout();
    navigate(resolvedPortalSlug ? `/client/login/${resolvedPortalSlug}` : "/client/login");
  };

  if (portalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading portal...</div>
      </div>
    );
  }

  if (notLinked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Account not linked to a portal</h1>
          <p className="text-muted-foreground">Please contact your agency for assistance.</p>
        </Card>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const basePortalPath = resolvedPortalSlug ? `/client/portal/${resolvedPortalSlug}` : "/client/portal";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            {client.logo_url && <img src={client.logo_url} alt={client.name} className="h-10 w-10 object-contain" />}
            <div>
              <h1 className="text-lg md:text-xl font-semibold">{client.name}</h1>
              <p className="text-xs text-muted-foreground hidden md:block">Client Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <ClientPortalNotificationCenter />
            {!isMobile && <span className="text-sm text-muted-foreground">{client.name}</span>}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className={cn("container flex", isMobile ? "px-4 py-4 pb-20" : "px-6 py-6")}>
        {/* Sidebar - Hidden on mobile */}
        {!isMobile && (
          <aside className="w-64 shrink-0 pr-6">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const targetPath = `${basePortalPath}${item.path ? `/${item.path}` : ""}`;
                const isActive = window.location.pathname === targetPath;

                return (
                  <Link
                    key={item.path}
                    to={targetPath}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <Outlet context={{ client, clientId: client.id, clientUser: null }} />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <ClientPortalMobileBottomNav />}
    </div>
  );
}

export function ClientPortalLayout() {
  return <ClientPortalLayoutContent />;
}
