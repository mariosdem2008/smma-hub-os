// ============================================================================
// Agency Onboarding Page
// Redirects to Agency Brain management
// ============================================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function AiOnboardingAgency() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to agency brain page
    navigate('/agency/brain', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Redirecting to Agency Brain...</p>
      </div>
    </div>
  );
}
