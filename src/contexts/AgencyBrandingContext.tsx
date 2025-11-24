import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface AgencyBranding {
  agency_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  accent_color: string;
  header_bg_color: string | null;
  sidebar_bg_color: string | null;
  content_bg_color: string | null;
  card_bg_color: string | null;
  font_primary: string | null;
  font_secondary: string | null;
  custom_domain: string | null;
  domain_status: string | null;
  email_sender_name: string | null;
  email_footer: string | null;
  layout_style: string | null;
  section_labels: any;
}

interface AgencyBrandingContextType {
  branding: AgencyBranding | null;
  loading: boolean;
  refreshBranding: () => Promise<void>;
}

const AgencyBrandingContext = createContext<AgencyBrandingContextType>({
  branding: null,
  loading: true,
  refreshBranding: async () => {},
});

export function AgencyBrandingProvider({ children, agencyId }: { children: ReactNode; agencyId?: string }) {
  const [branding, setBranding] = useState<AgencyBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchBranding = async () => {
    if (!agencyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('agency_branding')
        .select('*')
        .eq('agency_id', agencyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching agency branding:', error);
        return;
      }

      setBranding(data);
    } catch (error) {
      console.error('Error fetching agency branding:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, [agencyId, user]);

  // Apply branding to CSS variables and fonts
  useEffect(() => {
    if (branding) {
      const root = document.documentElement;
      if (branding.primary_color) {
        const hsl = hexToHSL(branding.primary_color);
        root.style.setProperty('--primary', hsl);
      }
      if (branding.accent_color) {
        const hsl = hexToHSL(branding.accent_color);
        root.style.setProperty('--accent', hsl);
      }
      if (branding.header_bg_color) {
        root.style.setProperty('--header-bg', branding.header_bg_color);
      }
      if (branding.sidebar_bg_color) {
        root.style.setProperty('--sidebar-bg', branding.sidebar_bg_color);
      }
      if (branding.content_bg_color) {
        root.style.setProperty('--content-bg', branding.content_bg_color);
      }
      if (branding.card_bg_color) {
        root.style.setProperty('--card-bg', branding.card_bg_color);
      }
      if (branding.font_primary) {
        root.style.setProperty('--font-primary', branding.font_primary);
      }
      if (branding.font_secondary) {
        root.style.setProperty('--font-secondary', branding.font_secondary);
      }
      if (branding.favicon_url) {
        const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
        if (link) {
          link.href = branding.favicon_url;
        }
      }
      
      // Apply layout style classes
      if (branding.layout_style) {
        root.setAttribute('data-layout', branding.layout_style);
      }
    }
  }, [branding]);

  return (
    <AgencyBrandingContext.Provider value={{ branding, loading, refreshBranding: fetchBranding }}>
      {children}
    </AgencyBrandingContext.Provider>
  );
}

// Helper function to convert hex to HSL format for Tailwind
function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h} ${s}% ${l}%`;
}

export const useAgencyBranding = () => useContext(AgencyBrandingContext);
