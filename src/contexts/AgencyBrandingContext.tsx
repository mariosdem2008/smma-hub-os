import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface AgencyBranding {
  agency_id: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  custom_domain: string | null;
  email_sender_name: string | null;
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

  // Apply branding to CSS variables
  useEffect(() => {
    if (branding) {
      const root = document.documentElement;
      if (branding.primary_color) {
        root.style.setProperty('--primary', branding.primary_color);
      }
      if (branding.accent_color) {
        root.style.setProperty('--accent', branding.accent_color);
      }
    }
  }, [branding]);

  return (
    <AgencyBrandingContext.Provider value={{ branding, loading, refreshBranding: fetchBranding }}>
      {children}
    </AgencyBrandingContext.Provider>
  );
}

export const useAgencyBranding = () => useContext(AgencyBrandingContext);
