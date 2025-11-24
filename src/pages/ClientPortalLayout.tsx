import { useParams, Link, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useClientPortalAccess } from "@/hooks/useClientPortalAccess";
import { useClientFonts } from "@/hooks/useClientFonts";
import { AgencyBrandingProvider, useAgencyBranding } from "@/contexts/AgencyBrandingContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Palette,
  Share2,
  Lightbulb,
  FolderOpen,
  LogOut,
  CalendarDays,
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
  { path: "", label: "Overview", key: "overview", icon: LayoutDashboard },
  { path: "content-calendar", label: "Content Calendar", key: "content_calendar", icon: CalendarDays },
  { path: "ideas", label: "Ideas", key: "ideas", icon: Lightbulb },
  { path: "assets", label: "Assets", key: "assets", icon: FolderOpen },
  { path: "branding", label: "Branding", key: "branding", icon: Palette },
  { path: "social", label: "Social Profiles", key: "social", icon: Share2 },
  { path: "deliverables", label: "Deliverables", key: "deliverables", icon: FolderOpen },
  { path: "uploads", label: "My Uploads", key: "uploads", icon: Share2 },
];

function ClientPortalLayoutContent() {
  const { portalSlug } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { clientId, loading, hasAccess } = useClientPortalAccess(portalSlug);
  const [client, setClient] = useState<Client | null>(null);
  const { branding } = useAgencyBranding();

  // Load fonts dynamically (client fonts or agency branding fonts)
  useClientFonts({
    primaryFont: branding?.font_primary || client?.primary_font,
    secondaryFont: branding?.font_secondary || client?.secondary_font,
  });

  // Get custom section labels
  const getSectionLabel = (key: string, defaultLabel: string) => {
    if (branding?.section_labels && branding.section_labels[key]) {
      return branding.section_labels[key];
    }
    return defaultLabel;
  };

  useEffect(() => {
    if (!loading && !hasAccess) {
      navigate(`/client-portal/${portalSlug}/login`);
    }
  }, [loading, hasAccess, navigate, portalSlug]);

  useEffect(() => {
    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  const fetchClient = async () => {
    if (!clientId) return;

    const { data } = await supabase
      .from("clients")
      .select(`
        id, 
        name, 
        logo_url, 
        primary_font, 
        secondary_font, 
        brand_colors, 
        website, 
        notes,
        niche,
        tone_of_voice,
        agency_id
      `)
      .eq("id", clientId)
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

  const handleSignOut = async () => {
    await signOut();
    navigate(`/client-portal/${portalSlug}/login`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading portal...</div>
      </div>
    );
  }

  if (!hasAccess || !clientId || !client) {
    return null;
  }

  const layoutClass = branding?.layout_style || 'default';

  return (
    <div 
      className="min-h-screen" 
      data-layout={layoutClass}
      style={{ backgroundColor: branding?.content_bg_color || 'hsl(var(--background))' }}
    >
      {/* Top Nav */}
      <header 
        className="sticky top-0 z-50 border-b backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ backgroundColor: branding?.header_bg_color || 'hsl(var(--background))' }}
      >
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {(branding?.logo_url || client.logo_url) && (
              <img
                src={branding?.logo_url || client.logo_url}
                alt={branding?.email_sender_name || client.name}
                className="h-10 w-10 object-contain"
              />
            )}
            <div style={{ fontFamily: branding?.font_primary || 'inherit' }}>
              <h1 className="text-xl font-semibold">{client.name}</h1>
              <p className="text-xs text-muted-foreground">Client Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {branding?.email_sender_name 
                ? `Powered by ${branding.email_sender_name}`
                : "Powered by SMMAHUB"
              }
            </span>
            {user && (
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container flex px-6 py-6">
        {/* Sidebar */}
        <aside 
          className={cn(
            "shrink-0 pr-6 rounded-lg p-4 -ml-4",
            layoutClass === 'minimal' ? 'w-20' : layoutClass === 'bold' ? 'w-72' : 'w-64'
          )}
          style={{ backgroundColor: branding?.sidebar_bg_color || 'transparent' }}
        >
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                window.location.pathname ===
                `/client-portal/${portalSlug}${item.path ? `/${item.path}` : ""}`;

              return (
                <Link
                  key={item.path}
                  to={`/client-portal/${portalSlug}${item.path ? `/${item.path}` : ""}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors",
                    layoutClass === 'minimal' ? 'rounded-sm justify-center' :
                    layoutClass === 'bold' ? 'rounded-xl' :
                    layoutClass === 'modern' ? 'rounded-lg' :
                    'rounded-md',
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  style={{ fontFamily: branding?.font_primary || 'inherit' }}
                >
                  <Icon className="h-4 w-4" />
                  {layoutClass !== 'minimal' && (
                    <span>{getSectionLabel(item.key, item.label)}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0" style={{ fontFamily: branding?.font_secondary || 'inherit' }}>
          <Outlet context={{ client, clientId }} />
        </main>
      </div>
    </div>
  );
}

export function ClientPortalLayout() {
  const { portalSlug } = useParams();
  const [agencyId, setAgencyId] = useState<string>('');

  useEffect(() => {
    const fetchAgencyId = async () => {
      if (!portalSlug) return;
      
      const { data } = await supabase
        .from('clients')
        .select('agency_id')
        .eq('portal_slug', portalSlug)
        .single();
      
      if (data) setAgencyId(data.agency_id);
    };
    
    fetchAgencyId();
  }, [portalSlug]);

  return (
    <AgencyBrandingProvider agencyId={agencyId}>
      <ClientPortalLayoutContent />
    </AgencyBrandingProvider>
  );
}
