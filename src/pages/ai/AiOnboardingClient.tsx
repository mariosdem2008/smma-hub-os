// ============================================================================
// AI Client Onboarding V4 Page
// Routes to OnboardingWizard with client context
// ============================================================================

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientOnboardingChatShell } from '@/components/onboarding-chat-client/ClientOnboardingChatShell';
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
        .select('id, agency_id')
        .eq('id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    retry: false,
    refetchOnWindowFocus: false,
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

  // No client selected state
  if (!clientId) {
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

  // Error or not-found state
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

  // Missing agency ownership metadata
  if (!client.agency_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Client setup is incomplete</h1>
          <p className="text-muted-foreground">
            This client is missing agency context. Re-open from Clients or recreate the client.
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

  return <ClientOnboardingChatShell clientId={clientId} agencyId={client.agency_id} />;
}
