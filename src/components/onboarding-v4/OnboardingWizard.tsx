// ============================================================================
// Onboarding Wizard V4
// Main orchestrator component for the 18-question micro-step wizard
// ============================================================================

import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import { ReadinessMeter } from './components/ReadinessMeter';
import { LivePreviewPanel } from './components/LivePreviewPanel';

import type { OnboardingFlowType, OnboardingProfile } from '@/types/onboarding';

// Step components (lazy loaded in production)
import { BusinessNameStep } from './steps/BusinessNameStep';
import { WebsiteSocialsStep } from './steps/WebsiteSocialsStep';
import { AiScanStep } from './steps/AiScanStep';
import { MarketScopeStep } from './steps/MarketScopeStep';
import { LanguagesStep } from './steps/LanguagesStep';
import { OfferTypeStep } from './steps/OfferTypeStep';
import { OfferDetailsStep } from './steps/OfferDetailsStep';
import { BusinessModelStep } from './steps/BusinessModelStep';
import { IdealCustomerStep } from './steps/IdealCustomerStep';
import { PainPointsStep } from './steps/PainPointsStep';
import { DesiredOutcomeStep } from './steps/DesiredOutcomeStep';
import { SalesCycleStep } from './steps/SalesCycleStep';
import { CompetitorsStep } from './steps/CompetitorsStep';
import { DifferentiatorsStep } from './steps/DifferentiatorsStep';
import { ProofLevelStep } from './steps/ProofLevelStep';
import { ProofPointsStep } from './steps/ProofPointsStep';
import { EnabledChannelsStep } from './steps/EnabledChannelsStep';
import { PrimaryGoalStep } from './steps/PrimaryGoalStep';
import { CadenceStep } from './steps/CadenceStep';
import { ReviewStep } from './steps/ReviewStep';

// ============================================================================
// Step Renderer
// ============================================================================

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  q1_business_name: BusinessNameStep,
  q2_website_socials: WebsiteSocialsStep,
  ai_scan: AiScanStep,
  q3_market_scope: MarketScopeStep,
  q4_languages: LanguagesStep,
  q5_offer_type: OfferTypeStep,
  q6_offer_details: OfferDetailsStep,
  q7_business_model: BusinessModelStep,
  q8_ideal_customer: IdealCustomerStep,
  q9_pain_points: PainPointsStep,
  q10_desired_outcome: DesiredOutcomeStep,
  q11_sales_cycle: SalesCycleStep,
  q12_competitors: CompetitorsStep,
  q13_differentiators: DifferentiatorsStep,
  q14_proof_level: ProofLevelStep,
  q15_proof_points: ProofPointsStep,
  q16_enabled_channels: EnabledChannelsStep,
  q17_primary_goal: PrimaryGoalStep,
  q18_cadence: CadenceStep,
  review: ReviewStep,
};

function StepRenderer() {
  const { state, getCurrentStep } = useOnboarding();
  const currentStep = getCurrentStep();

  if (!currentStep) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="ml-4 text-muted-foreground">Step not found</p>
      </div>
    );
  }

  const StepComponent = STEP_COMPONENTS[currentStep.id];

  if (!StepComponent) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="ml-4 text-muted-foreground">
          Step component not implemented: {currentStep.id}
        </p>
      </div>
    );
  }

  return <StepComponent />;
}

// ============================================================================
// Wizard Content
// ============================================================================

interface WizardContentProps {
  clientId: string;
  agencyId: string;
  flowType: OnboardingFlowType;
}

function WizardContent({ clientId, agencyId, flowType }: WizardContentProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { state, setProfile, setLoading, setError, setSaving, updateProfile } = useOnboarding();

  // Load existing profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);

        // Check for existing profile
        const { data: profile, error } = await supabase
          .from('client_onboarding_profiles')
          .select('*')
          .eq('client_id', clientId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (profile) {
          setProfile(profile as unknown as Partial<OnboardingProfile>);
        } else {
          // Create new profile
          const { data: user } = await supabase.auth.getUser();
          const newProfile: Partial<OnboardingProfile> = {
            client_id: clientId,
            agency_id: agencyId,
            flow_type: flowType,
            current_step: 1,
            readiness_score: 0,
            blockers: [],
            created_by: user?.user?.id,
          };
          setProfile(newProfile);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load onboarding profile');
        toast({
          title: 'Error',
          description: 'Failed to load onboarding profile',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [clientId, agencyId, flowType, setProfile, setLoading, setError, toast]);

  // Auto-save profile on changes (debounced)
  useEffect(() => {
    if (state.isLoading || !state.profile.client_id) return;

    const timeout = setTimeout(async () => {
      try {
        setSaving(true);

        const { error } = await supabase.rpc('upsert_onboarding_profile', {
          p_client_id: clientId,
          p_agency_id: agencyId,
          p_flow_type: state.profile.flow_type ?? flowType,
          p_current_step: state.currentStepIndex + 1,
          p_profile_data: state.profile as unknown as Record<string, unknown>,
        });

        if (error) throw error;
      } catch (err) {
        console.error('Failed to save profile:', err);
        // Don't show toast for every save - only on critical errors
      } finally {
        setSaving(false);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeout);
  }, [state.profile, state.currentStepIndex, clientId, agencyId, flowType, state.isLoading, setSaving]);

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading onboarding...</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const showPreviewPanel = flowType === 'agency_led' && state.currentStepIndex >= 3;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar with readiness meter */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <ReadinessMeter score={state.readinessScore} size="md" />
        </div>
      </div>

      {/* Main content */}
      <div className={`max-w-7xl mx-auto px-6 py-8 ${showPreviewPanel ? 'lg:flex lg:gap-8' : ''}`}>
        {/* Wizard content */}
        <div className={showPreviewPanel ? 'lg:flex-1 lg:max-w-3xl' : 'max-w-2xl mx-auto'}>
          <StepRenderer />
        </div>

        {/* Preview panel (agency flow only) */}
        {showPreviewPanel && (
          <div className="hidden lg:block lg:w-80 lg:flex-shrink-0">
            <div className="sticky top-24">
              <LivePreviewPanel />
            </div>
          </div>
        )}
      </div>

      {/* Saving indicator */}
      {state.isSaving && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-background border rounded-lg px-3 py-2 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Saving...</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Wizard Component
// ============================================================================

interface OnboardingWizardProps {
  clientId: string;
  agencyId: string;
  flowType?: OnboardingFlowType;
}

export function OnboardingWizard({
  clientId,
  agencyId,
  flowType = 'agency_led',
}: OnboardingWizardProps) {
  return (
    <OnboardingProvider flowType={flowType}>
      <WizardContent
        clientId={clientId}
        agencyId={agencyId}
        flowType={flowType}
      />
    </OnboardingProvider>
  );
}

export default OnboardingWizard;
