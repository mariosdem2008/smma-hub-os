// ============================================================================
// Onboarding Profile React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OnboardingProfile, OnboardingFlowType, AiScanResult } from '@/types/onboarding';

// Query keys
export const onboardingProfileKeys = {
  all: ['onboarding-profiles'] as const,
  byClient: (clientId: string) => [...onboardingProfileKeys.all, clientId] as const,
  status: (clientId: string) => [...onboardingProfileKeys.byClient(clientId), 'status'] as const,
};

// Fetch profile for a client
export function useOnboardingProfile(clientId: string | undefined) {
  return useQuery({
    queryKey: onboardingProfileKeys.byClient(clientId ?? ''),
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from('client_onboarding_profiles')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;

      return data as unknown as OnboardingProfile | null;
    },
    enabled: !!clientId,
  });
}

// Fetch profile status (for ClientDetail gate)
export function useOnboardingProfileStatus(clientId: string | undefined) {
  return useQuery({
    queryKey: onboardingProfileKeys.status(clientId ?? ''),
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await supabase.rpc('get_onboarding_profile_status', {
        p_client_id: clientId,
      });

      if (error) throw error;

      return data as {
        exists: boolean;
        completed: boolean;
        flow_type?: OnboardingFlowType;
        current_step?: number;
        readiness_score?: number;
        blockers?: { field: string; label: string }[];
        completed_at?: string;
      };
    },
    enabled: !!clientId,
  });
}

// Create or update profile
export function useUpsertOnboardingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
      profile,
      flowType = 'agency_led',
    }: {
      clientId: string;
      agencyId: string;
      profile: Partial<OnboardingProfile>;
      flowType?: OnboardingFlowType;
    }) => {
      const { data, error } = await supabase.rpc('upsert_onboarding_profile', {
        p_client_id: clientId,
        p_agency_id: agencyId,
        p_flow_type: flowType,
        p_profile_json: profile,
      });

      if (error) throw error;

      return data as unknown as OnboardingProfile;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: onboardingProfileKeys.byClient(variables.clientId) });
    },
  });
}

// Update profile fields
export function useUpdateOnboardingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      updates,
    }: {
      clientId: string;
      updates: Partial<OnboardingProfile>;
    }) => {
      const { data, error } = await supabase
        .from('client_onboarding_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', clientId)
        .select()
        .single();

      if (error) throw error;

      return data as unknown as OnboardingProfile;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: onboardingProfileKeys.byClient(variables.clientId) });
    },
  });
}

// Complete onboarding (marks as completed and triggers strategy generation)
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
    }: {
      clientId: string;
      agencyId: string;
    }) => {
      const { data, error } = await supabase.rpc('complete_onboarding_profile', {
        p_client_id: clientId,
      });

      if (error) throw error;

      return data as { success: boolean; strategy_id: string };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: onboardingProfileKeys.byClient(variables.clientId) });
    },
  });
}

// Trigger AI scan
export function useAiOnboardingScan() {
  return useMutation({
    mutationFn: async ({
      agencyId,
      clientId,
      website,
      socialLinks,
    }: {
      agencyId: string;
      clientId: string;
      website: string;
      socialLinks?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-onboarding-scan', {
        body: {
          agency_id: agencyId,
          client_id: clientId,
          website,
          social_links: socialLinks,
        },
      });

      if (error) throw error;

      return data as AiScanResult;
    },
  });
}

// Get AI suggestions for a step
export function useAiOnboardingSuggest() {
  return useMutation({
    mutationFn: async ({
      agencyId,
      clientId,
      stepId,
      profile,
    }: {
      agencyId: string;
      clientId: string;
      stepId: 'q8' | 'q9' | 'q10' | 'q12' | 'q13';
      profile: Partial<OnboardingProfile>;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-onboarding-suggest', {
        body: {
          agency_id: agencyId,
          client_id: clientId,
          step_id: stepId,
          profile,
        },
      });

      if (error) throw error;

      return data as {
        suggestions: { id: string; label: string; confidence: number }[];
        fallback_enabled: boolean;
      };
    },
  });
}
