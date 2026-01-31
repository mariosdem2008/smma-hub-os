// ============================================================================
// AI Client Onboarding V4 Page
// Routes to OnboardingWizard with client context
// ============================================================================

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingV5Wizard } from '@/components/onboarding-v5/OnboardingV5Wizard';
import { Loader2 } from 'lucide-react';

export default function AiOnboardingClient() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  // Fetch client data (includes agency_id)
  const { data: client, isLoading, error } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Client not found</h1>
          <p className="text-muted-foreground">
            The client you're trying to onboard doesn't exist or you don't have access.
          </p>
          <button
            onClick={() => navigate('/clients')}
            className="text-primary underline"
          >
            Go back to clients
          </button>
        </div>
      </div>
    );
  }

  // No clientId or agency_id state
  if (!clientId || !client.agency_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">No client selected</h1>
          <p className="text-muted-foreground">
            Please select a client to start onboarding.
          </p>
          <button
            onClick={() => navigate('/clients')}
            className="text-primary underline"
          >
            Go to clients
          </button>
        </div>
      </div>
    );
  }

  return (
    <OnboardingV5Wizard clientId={clientId} agencyId={client.agency_id} />
  );
}
