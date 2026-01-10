// ============================================================================
// OnboardingContext Component Tests
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { OnboardingProvider, useOnboarding } from '../OnboardingContext';
import type { OnboardingProfile, AIScanResult } from '@/types/onboarding';
import type { ReactNode } from 'react';

// Wrapper component for testing
function createWrapper(props: { flowType?: 'agency_led' | 'client_self_serve' | 'agency_completion'; initialProfile?: Partial<OnboardingProfile> } = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <OnboardingProvider {...props}>
        {children}
      </OnboardingProvider>
    );
  };
}

describe('OnboardingContext', () => {
  describe('initial state', () => {
    it('creates initial state for agency_led flow', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper({ flowType: 'agency_led' }),
      });

      expect(result.current.state.flowType).toBe('agency_led');
      expect(result.current.state.currentStepIndex).toBe(0);
      expect(result.current.state.steps.length).toBe(20); // All 20 steps
      expect(result.current.state.readinessScore).toBeLessThan(15);
      expect(result.current.state.hardBlockersCleared).toBe(false);
    });

    it('creates initial state for client_self_serve flow', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper({ flowType: 'client_self_serve' }),
      });

      expect(result.current.state.flowType).toBe('client_self_serve');
      expect(result.current.state.steps.length).toBe(13); // Q1-Q12 + AI scan
    });

    it('initializes with provided profile', async () => {
      const initialProfile: Partial<OnboardingProfile> = {
        q1_business_name: 'Test Business',
        q2_website: 'https://example.com',
      };

      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper({ initialProfile }),
      });

      // Wait for useEffect to process
      await waitFor(() => {
        expect(result.current.state.profile.q1_business_name).toBe('Test Business');
      });
    });
  });

  describe('setProfile', () => {
    it('sets entire profile and recalculates readiness', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setProfile({
          q1_business_name: 'Test',
          q6_offer_name: 'Offer',
          q6_main_cta: 'book_call',
          q8_ideal_customer: 'Customer',
          q10_desired_outcome: 'Outcome',
          q16_enabled_channels: ['instagram'],
          q18_cadence: { instagram: 3 },
        });
      });

      expect(result.current.state.profile.q1_business_name).toBe('Test');
      expect(result.current.state.hardBlockersCleared).toBe(true);
      expect(result.current.state.readinessScore).toBeGreaterThan(0);
    });
  });

  describe('updateProfile', () => {
    it('merges updates into existing profile', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateProfile({ q1_business_name: 'First' });
      });

      act(() => {
        result.current.updateProfile({ q2_website: 'https://test.com' });
      });

      expect(result.current.state.profile.q1_business_name).toBe('First');
      expect(result.current.state.profile.q2_website).toBe('https://test.com');
    });

    it('recalculates readiness after update', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      const initialScore = result.current.state.readinessScore;

      act(() => {
        result.current.updateProfile({
          q1_business_name: 'Test',
          q2_website: 'https://test.com',
        });
      });

      expect(result.current.state.readinessScore).toBeGreaterThan(initialScore);
    });
  });

  describe('updateField', () => {
    it('updates field with provenance', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateField('q1_business_name', 'Test Business', 'user_typed');
      });

      expect(result.current.state.profile.q1_business_name).toBe('Test Business');
      expect(result.current.state.profile.q1_provenance).toBe('user_typed');
    });

    it('supports different provenance types', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.updateField('q8_ideal_customer', 'AI suggested customer', 'ai_assumed');
      });

      expect(result.current.state.profile.q8_ideal_customer).toBe('AI suggested customer');
      expect(result.current.state.profile.q8_provenance).toBe('ai_assumed');
    });
  });

  describe('navigation', () => {
    it('nextStep advances to next step', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.currentStepIndex).toBe(0);

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.state.currentStepIndex).toBe(1);
    });

    it('nextStep tracks history for back navigation', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.nextStep();
      });
      act(() => {
        result.current.nextStep();
      });

      expect(result.current.state.stepHistory).toEqual([0, 1]);
    });

    it('prevStep returns to previous step from history', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.nextStep(); // 0 -> 1
      });
      act(() => {
        result.current.nextStep(); // 1 -> 2
      });
      act(() => {
        result.current.prevStep(); // 2 -> 1
      });

      expect(result.current.state.currentStepIndex).toBe(1);
    });

    it('prevStep does nothing when no history', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.prevStep();
      });

      expect(result.current.state.currentStepIndex).toBe(0);
    });

    it('goToStep navigates to specific step', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.goToStep(5);
      });

      expect(result.current.state.currentStepIndex).toBe(5);
      expect(result.current.state.stepHistory).toContain(0);
    });

    it('nextStep stops at last step', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      const lastIndex = result.current.state.steps.length - 1;

      // Go to last step
      act(() => {
        result.current.goToStep(lastIndex);
      });

      // Try to go further
      act(() => {
        result.current.nextStep();
      });

      expect(result.current.state.currentStepIndex).toBe(lastIndex);
    });
  });

  describe('AI scan', () => {
    it('setAiScanResult stores scan result', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      const scanResult: AIScanResult = {
        extracted: {
          niche: 'Tech consulting',
          business_model: 'b2b',
          audience: ['CTOs', 'Tech leads'],
          competitors: [{ name: 'Competitor A' }],
          differentiators: ['Expertise', 'Speed'],
          pain_points: ['Slow delivery', 'High cost'],
        },
        confidence: 85,
        source_urls: ['https://example.com'],
        cached_at: new Date().toISOString(),
      };

      act(() => {
        result.current.setAiScanResult(scanResult);
      });

      expect(result.current.state.aiScanResult).toEqual(scanResult);
      expect(result.current.state.profile.ai_scan_result).toEqual(scanResult);
    });

    it('acceptAiScan prefills fields from scan', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      const scanResult: AIScanResult = {
        extracted: {
          business_model: 'b2b',
          audience: ['CTOs', 'Tech leads'],
          competitors: [{ name: 'Competitor A' }],
          differentiators: ['Expertise', 'Speed'],
          pain_points: ['Slow delivery', 'High cost', 'Poor quality'],
        },
        confidence: 85,
        source_urls: ['https://example.com'],
        cached_at: new Date().toISOString(),
      };

      act(() => {
        result.current.setAiScanResult(scanResult);
      });

      act(() => {
        result.current.acceptAiScan();
      });

      expect(result.current.state.profile.q7_business_model).toBe('b2b');
      expect(result.current.state.profile.q7_provenance).toBe('ai_prefilled');
      expect(result.current.state.profile.q8_ideal_customer).toBe('CTOs');
      expect(result.current.state.profile.q8_provenance).toBe('ai_prefilled');
      expect(result.current.state.profile.q9_pain_points).toEqual(['Slow delivery', 'High cost', 'Poor quality']);
      expect(result.current.state.profile.ai_scan_accepted).toBe(true);
    });

    it('acceptAiScan does not overwrite existing values', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      // Set existing value first
      act(() => {
        result.current.updateProfile({
          q7_business_model: 'b2c',
          q7_provenance: 'user_selected',
        });
      });

      const scanResult: AIScanResult = {
        extracted: {
          business_model: 'b2b', // Different from existing
          audience: ['CTOs'],
        },
        confidence: 85,
        source_urls: ['https://example.com'],
        cached_at: new Date().toISOString(),
      };

      act(() => {
        result.current.setAiScanResult(scanResult);
      });

      act(() => {
        result.current.acceptAiScan();
      });

      // Should keep existing value
      expect(result.current.state.profile.q7_business_model).toBe('b2c');
      expect(result.current.state.profile.q7_provenance).toBe('user_selected');
    });

    it('setAiScanLoading updates loading state', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setAiScanLoading(true);
      });

      expect(result.current.state.aiScanLoading).toBe(true);

      act(() => {
        result.current.setAiScanLoading(false);
      });

      expect(result.current.state.aiScanLoading).toBe(false);
    });
  });

  describe('helpers', () => {
    it('getCurrentStep returns current step config', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      const step = result.current.getCurrentStep();
      expect(step?.id).toBe('q1_business_name');
      expect(step?.stepNumber).toBe(1);

      act(() => {
        result.current.nextStep();
      });

      const nextStep = result.current.getCurrentStep();
      expect(nextStep?.id).toBe('q2_website_socials');
    });

    it('getProgress returns percentage complete', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      expect(result.current.getProgress()).toBe(5); // 1/20 = 5%

      act(() => {
        result.current.goToStep(9);
      });

      expect(result.current.getProgress()).toBe(50); // 10/20 = 50%
    });

    it('canProceed checks step validation', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      // Step 1 requires business name
      expect(result.current.canProceed()).toBe(false);

      act(() => {
        result.current.updateProfile({ q1_business_name: 'Test Business' });
      });

      expect(result.current.canProceed()).toBe(true);
    });

    it('canComplete checks hard blockers', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canComplete()).toBe(false);

      act(() => {
        result.current.setProfile({
          q6_offer_name: 'Offer',
          q6_main_cta: 'book_call',
          q8_ideal_customer: 'Customer',
          q10_desired_outcome: 'Outcome',
          q16_enabled_channels: ['instagram'],
          q18_cadence: { instagram: 3 },
        });
      });

      expect(result.current.canComplete()).toBe(true);
    });
  });

  describe('UI state', () => {
    it('setLoading updates loading state', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.state.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.state.isLoading).toBe(false);
    });

    it('setSaving updates saving state', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSaving(true);
      });

      expect(result.current.state.isSaving).toBe(true);
    });

    it('setError updates error state', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setError('Something went wrong');
      });

      expect(result.current.state.error).toBe('Something went wrong');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets state to initial values', () => {
      const { result } = renderHook(() => useOnboarding(), {
        wrapper: createWrapper(),
      });

      // Modify state
      act(() => {
        result.current.updateProfile({ q1_business_name: 'Test' });
        result.current.nextStep();
        result.current.setError('Error');
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.state.profile.q1_business_name).toBeUndefined();
      expect(result.current.state.currentStepIndex).toBe(0);
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.stepHistory).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws error when useOnboarding used outside provider', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        const result = renderHook(() => useOnboarding());
        void result.current.state;
      }).toThrow('useOnboarding must be used within an OnboardingProvider');
      errorSpy.mockRestore();
    });
  });
});
