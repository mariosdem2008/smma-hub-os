// ============================================================================
// Onboarding V4 Context
// State management for the onboarding wizard
// ============================================================================

import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react';
import type {
  OnboardingProfile,
  OnboardingProfileUpdate,
  OnboardingFlowType,
  OnboardingStepConfig,
  AIScanResult,
  AnswerProvenance,
  OnboardingBlocker,
} from '@/types/onboarding';
import { ONBOARDING_STEPS, getStepsForFlow, getTotalSteps } from '@/types/onboarding';
import { calculateReadiness, getBlockers, areBlockersCleared } from '@/lib/onboarding/readiness';

// ============================================================================
// State Types
// ============================================================================

interface OnboardingState {
  // Profile data
  profile: Partial<OnboardingProfile>;

  // Flow state
  flowType: OnboardingFlowType;
  currentStepIndex: number;
  steps: OnboardingStepConfig[];

  // AI state
  aiScanResult: AIScanResult | null;
  aiScanLoading: boolean;
  aiSuggestions: Record<string, { suggestions: Array<{ id: string; label: string; confidence: number }>; loading: boolean }>;

  // Readiness
  readinessScore: number;
  blockers: OnboardingBlocker[];
  hardBlockersCleared: boolean;

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Navigation history for back button
  stepHistory: number[];
}

type OnboardingAction =
  | { type: 'SET_PROFILE'; payload: Partial<OnboardingProfile> }
  | { type: 'UPDATE_PROFILE'; payload: OnboardingProfileUpdate }
  | { type: 'SET_FLOW_TYPE'; payload: OnboardingFlowType }
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; payload: number }
  | { type: 'SET_AI_SCAN_RESULT'; payload: AIScanResult | null }
  | { type: 'SET_AI_SCAN_LOADING'; payload: boolean }
  | { type: 'SET_AI_SUGGESTIONS'; payload: { stepId: string; suggestions: Array<{ id: string; label: string; confidence: number }>; loading: boolean } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RECALCULATE_READINESS' }
  | { type: 'RESET' };

// ============================================================================
// Initial State
// ============================================================================

const createInitialState = (flowType: OnboardingFlowType = 'agency_led'): OnboardingState => ({
  profile: {},
  flowType,
  currentStepIndex: 0,
  steps: getStepsForFlow(flowType),
  aiScanResult: null,
  aiScanLoading: false,
  aiSuggestions: {},
  readinessScore: 0,
  blockers: [],
  hardBlockersCleared: false,
  isLoading: true,
  isSaving: false,
  error: null,
  stepHistory: [],
});

// ============================================================================
// Reducer
// ============================================================================

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_PROFILE': {
      const readiness = calculateReadiness(action.payload);
      return {
        ...state,
        profile: action.payload,
        readinessScore: readiness.percentage,
        blockers: getBlockers(action.payload),
        hardBlockersCleared: readiness.hardBlockersCleared,
        aiScanResult: action.payload.ai_scan_result ?? null,
      };
    }

    case 'UPDATE_PROFILE': {
      const updatedProfile = { ...state.profile, ...action.payload };
      const readiness = calculateReadiness(updatedProfile);
      return {
        ...state,
        profile: updatedProfile,
        readinessScore: readiness.percentage,
        blockers: getBlockers(updatedProfile),
        hardBlockersCleared: readiness.hardBlockersCleared,
      };
    }

    case 'SET_FLOW_TYPE': {
      const steps = getStepsForFlow(action.payload);
      return {
        ...state,
        flowType: action.payload,
        steps,
        currentStepIndex: 0,
        stepHistory: [],
      };
    }

    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStepIndex: action.payload,
      };

    case 'NEXT_STEP': {
      const nextIndex = Math.min(state.currentStepIndex + 1, state.steps.length - 1);
      return {
        ...state,
        currentStepIndex: nextIndex,
        stepHistory: [...state.stepHistory, state.currentStepIndex],
      };
    }

    case 'PREV_STEP': {
      if (state.stepHistory.length === 0) return state;
      const prevIndex = state.stepHistory[state.stepHistory.length - 1];
      return {
        ...state,
        currentStepIndex: prevIndex,
        stepHistory: state.stepHistory.slice(0, -1),
      };
    }

    case 'GO_TO_STEP':
      return {
        ...state,
        currentStepIndex: action.payload,
        stepHistory: [...state.stepHistory, state.currentStepIndex],
      };

    case 'SET_AI_SCAN_RESULT':
      return {
        ...state,
        aiScanResult: action.payload,
        profile: {
          ...state.profile,
          ai_scan_result: action.payload,
          ai_scan_at: action.payload ? new Date().toISOString() : null,
        },
      };

    case 'SET_AI_SCAN_LOADING':
      return {
        ...state,
        aiScanLoading: action.payload,
      };

    case 'SET_AI_SUGGESTIONS':
      return {
        ...state,
        aiSuggestions: {
          ...state.aiSuggestions,
          [action.payload.stepId]: {
            suggestions: action.payload.suggestions,
            loading: action.payload.loading,
          },
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'RECALCULATE_READINESS': {
      const readiness = calculateReadiness(state.profile);
      return {
        ...state,
        readinessScore: readiness.percentage,
        blockers: getBlockers(state.profile),
        hardBlockersCleared: readiness.hardBlockersCleared,
      };
    }

    case 'RESET':
      return createInitialState(state.flowType);

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface OnboardingContextValue {
  state: OnboardingState;

  // Profile actions
  setProfile: (profile: Partial<OnboardingProfile>) => void;
  updateProfile: (updates: OnboardingProfileUpdate) => void;
  updateField: <K extends keyof OnboardingProfile>(
    field: K,
    value: OnboardingProfile[K],
    provenance: AnswerProvenance
  ) => void;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;

  // AI actions
  setAiScanResult: (result: AIScanResult | null) => void;
  setAiScanLoading: (loading: boolean) => void;
  acceptAiScan: () => void;
  setAiSuggestions: (stepId: string, suggestions: Array<{ id: string; label: string; confidence: number }>, loading: boolean) => void;

  // UI state
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;

  // Helpers
  getCurrentStep: () => OnboardingStepConfig | undefined;
  getProgress: () => number;
  canProceed: () => boolean;
  canComplete: () => boolean;
  reset: () => void;

  // Completion
  completeOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface OnboardingProviderProps {
  children: ReactNode;
  flowType?: OnboardingFlowType;
  initialProfile?: Partial<OnboardingProfile>;
}

export function OnboardingProvider({
  children,
  flowType = 'agency_led',
  initialProfile,
}: OnboardingProviderProps) {
  const [state, dispatch] = useReducer(onboardingReducer, createInitialState(flowType));

  // Initialize with profile if provided
  useEffect(() => {
    if (initialProfile) {
      dispatch({ type: 'SET_PROFILE', payload: initialProfile });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [initialProfile]);

  // Profile actions
  const setProfile = useCallback((profile: Partial<OnboardingProfile>) => {
    dispatch({ type: 'SET_PROFILE', payload: profile });
  }, []);

  const updateProfile = useCallback((updates: OnboardingProfileUpdate) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: updates });
  }, []);

  const updateField = useCallback(<K extends keyof OnboardingProfile>(
    field: K,
    value: OnboardingProfile[K],
    provenance: AnswerProvenance
  ) => {
    // Extract the question prefix (e.g., "q1", "q6") from field name and append "_provenance"
    // Field names are like: q1_business_name, q6_offer_name, q8_ideal_customer
    // Provenance fields are: q1_provenance, q6_provenance, q8_provenance
    const fieldStr = String(field);
    const match = fieldStr.match(/^q\d+/);
    const provenanceField = match ? `${match[0]}_provenance` : fieldStr;
    dispatch({
      type: 'UPDATE_PROFILE',
      payload: {
        [field]: value,
        [provenanceField]: provenance,
      } as OnboardingProfileUpdate,
    });
  }, []);

  // Navigation
  const nextStep = useCallback(() => {
    dispatch({ type: 'NEXT_STEP' });
  }, []);

  const prevStep = useCallback(() => {
    dispatch({ type: 'PREV_STEP' });
  }, []);

  const goToStep = useCallback((index: number) => {
    dispatch({ type: 'GO_TO_STEP', payload: index });
  }, []);

  // AI actions
  const setAiScanResult = useCallback((result: AIScanResult | null) => {
    dispatch({ type: 'SET_AI_SCAN_RESULT', payload: result });
  }, []);

  const setAiScanLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_AI_SCAN_LOADING', payload: loading });
  }, []);

  const acceptAiScan = useCallback(() => {
    if (!state.aiScanResult) return;

    const extracted = state.aiScanResult.extracted;
    const updates: OnboardingProfileUpdate = {
      ai_scan_accepted: true,
    };

    // Prefill fields from scan result
    if (extracted.business_model && !state.profile.q7_business_model) {
      updates.q7_business_model = extracted.business_model;
      updates.q7_provenance = 'ai_prefilled';
    }
    if (extracted.audience?.length && !state.profile.q8_ideal_customer) {
      updates.q8_ideal_customer = extracted.audience[0];
      updates.q8_provenance = 'ai_prefilled';
    }
    if (extracted.pain_points?.length && (!state.profile.q9_pain_points || state.profile.q9_pain_points.length === 0)) {
      updates.q9_pain_points = extracted.pain_points.slice(0, 3);
      updates.q9_provenance = 'ai_prefilled';
    }
    if (extracted.competitors?.length && (!state.profile.q12_competitors || state.profile.q12_competitors.length === 0)) {
      updates.q12_competitors = extracted.competitors.slice(0, 3);
      updates.q12_provenance = 'ai_prefilled';
    }
    if (extracted.differentiators?.length && (!state.profile.q13_differentiators || state.profile.q13_differentiators.length === 0)) {
      updates.q13_differentiators = extracted.differentiators.slice(0, 4);
      updates.q13_provenance = 'ai_prefilled';
    }

    dispatch({ type: 'UPDATE_PROFILE', payload: updates });
  }, [state.aiScanResult, state.profile]);

  const setAiSuggestions = useCallback((
    stepId: string,
    suggestions: Array<{ id: string; label: string; confidence: number }>,
    loading: boolean
  ) => {
    dispatch({ type: 'SET_AI_SUGGESTIONS', payload: { stepId, suggestions, loading } });
  }, []);

  // UI state
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    dispatch({ type: 'SET_SAVING', payload: saving });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  // Helpers
  const getCurrentStep = useCallback(() => {
    return state.steps[state.currentStepIndex];
  }, [state.steps, state.currentStepIndex]);

  const getProgress = useCallback(() => {
    return Math.round(((state.currentStepIndex + 1) / state.steps.length) * 100);
  }, [state.currentStepIndex, state.steps.length]);

  const canProceed = useCallback(() => {
    const step = state.steps[state.currentStepIndex];
    if (!step) return false;

    // Check validation for current step
    // This is a simplified check - each step component should do detailed validation
    switch (step.id) {
      case 'q1_business_name':
        return !!state.profile.q1_business_name?.trim();
      case 'q2_website_socials':
        return !!state.profile.q2_website?.trim();
      case 'ai_scan':
        return true; // Can always proceed from scan
      case 'q6_offer_details':
        return !!state.profile.q6_offer_name?.trim() && !!state.profile.q6_main_cta?.trim();
      case 'q8_ideal_customer':
        return !!state.profile.q8_ideal_customer?.trim();
      case 'q10_desired_outcome':
        return !!state.profile.q10_desired_outcome?.trim();
      case 'q16_enabled_channels':
        return (state.profile.q16_enabled_channels?.length ?? 0) > 0;
      case 'review':
        return state.hardBlockersCleared;
      default:
        return true;
    }
  }, [state.steps, state.currentStepIndex, state.profile, state.hardBlockersCleared]);

  const canComplete = useCallback(() => {
    return state.hardBlockersCleared;
  }, [state.hardBlockersCleared]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!state.hardBlockersCleared) {
      throw new Error('Cannot complete onboarding: hard blockers not cleared');
    }

    // Call the complete RPC if we have a client_id
    if (state.profile.client_id) {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.rpc('complete_onboarding_profile', {
        p_client_id: state.profile.client_id,
      });

      if (error) {
        console.error('Failed to complete onboarding:', error);
        throw error;
      }

      const agencyId = state.profile.agency_id;
      const clientId = state.profile.client_id;
      if (!agencyId) {
        throw new Error('Missing agency_id for onboarding completion');
      }

      const priceMin = state.profile.q6_price_min;
      const priceMax = state.profile.q6_price_max;
      const pricing =
        typeof priceMin === 'number' || typeof priceMax === 'number'
          ? `${priceMin ?? ''}${priceMin != null && priceMax != null ? '-' : ''}${priceMax ?? ''}`.trim()
          : '';

      const rawResponses: Record<string, unknown> = {
        brand: state.profile.q1_business_name ?? '',
        website: state.profile.q2_website ?? '',
        platforms: state.profile.q2_social_links ?? [],
        offers: [
          state.profile.q6_offer_name,
          state.profile.q5_offer_type,
        ].filter(Boolean),
        differentiators: state.profile.q13_differentiators ?? [],
        audience: [
          state.profile.q8_ideal_customer,
          ...(state.profile.q9_pain_points ?? []),
        ].filter(Boolean),
        goals: state.profile.q17_primary_goal ? [state.profile.q17_primary_goal] : [],
        competitors: (state.profile.q12_competitors ?? [])
          .map((c) => c.name)
          .filter(Boolean),
        cta_styles: state.profile.q6_main_cta ? [state.profile.q6_main_cta] : [],
        pricing,
        pillars: (state.profile.q13_differentiators ?? []).slice(0, 6),
      };

      const { data: createResp, error: createErr } = await supabase.functions.invoke('ai-brains-client', {
        body: {
          action: 'create',
          agency_id: agencyId,
          client_id: clientId,
          brain_json: { raw_responses: rawResponses, followup_responses: {} },
        },
      });
      if (createErr) {
        console.error('Failed to create client brain:', createErr);
        throw createErr;
      }

      const brainId = createResp?.brain?.id as string | undefined;
      if (!brainId) {
        throw new Error('Client brain id missing');
      }

      const { error: updateErr } = await supabase.functions.invoke('ai-brains-client', {
        body: {
          action: 'update',
          agency_id: agencyId,
          client_id: clientId,
          brain_id: brainId,
          brain_json: { raw_responses: rawResponses, followup_responses: {} },
        },
      });
      if (updateErr) {
        console.error('Failed to update client brain:', updateErr);
        throw updateErr;
      }

      const { error: ingestErr } = await supabase.functions.invoke('ai-brain-ingest', {
        body: {
          scope: 'client',
          agency_id: agencyId,
          client_id: clientId,
          brain_id: brainId,
          source: 'onboarding_v4',
          raw_responses: rawResponses,
          followup_responses: {},
        },
      });
      if (ingestErr) {
        console.error('Failed to ingest client brain:', ingestErr);
        throw ingestErr;
      }
    }
  }, [state.hardBlockersCleared, state.profile]);

  const value: OnboardingContextValue = {
    state,
    setProfile,
    updateProfile,
    updateField,
    nextStep,
    prevStep,
    goToStep,
    setAiScanResult,
    setAiScanLoading,
    acceptAiScan,
    setAiSuggestions,
    setLoading,
    setSaving,
    setError,
    getCurrentStep,
    getProgress,
    canProceed,
    canComplete,
    reset,
    completeOnboarding,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

export { OnboardingContext };
