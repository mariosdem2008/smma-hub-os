// ============================================================================
// Agency Onboarding Page
// Redirects to AI Setup
// ============================================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function AiOnboardingAgency() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to AI Setup page
    navigate("/agency/ai-setup", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Redirecting to AI Setup...</p>
      </div>
    </div>
  );
}
