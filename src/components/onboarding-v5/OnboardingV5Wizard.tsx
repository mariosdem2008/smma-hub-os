import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { OnboardingProfile, OnboardingV5Meta, V5ScanResult, SocialChannel } from '@/types/onboarding';
import { CTA_OPTIONS, CONVERSION_PATH_OPTIONS, ONBOARDING_PRIMARY_GOAL_OPTIONS } from '@/types/onboarding';
import { OnboardingV5Layout } from './OnboardingV5Layout';
import { SectionNav } from './components/SectionNav';
import { RightRail } from './components/RightRail';
import { AIScanReviewDialog } from './components/AIScanReviewDialog';
import { BasicsSection } from './sections/BasicsSection';
import { GoalSection } from './sections/GoalSection';
import { OffersSection } from './sections/OffersSection';
import { AudienceSection } from './sections/AudienceSection';
import { BrandSection } from './sections/BrandSection';
import { ProofSection } from './sections/ProofSection';
import { ChannelsSection } from './sections/ChannelsSection';
import { ReviewSection } from './sections/ReviewSection';
import { getSectionRequirementSummary, getV5ProgressSummary, type V5SectionId } from './lib/progress';
import { sanitizeList, sanitizeText } from './lib/sanitize';
import { trackOnboardingEvent } from './lib/events';
import { getFieldLabel } from './lib/labels';
import { Skeleton } from '@/components/ui/skeleton';

const SECTIONS: Array<{ id: V5SectionId; title: string; description: string }> = [
  { id: 'basics', title: 'Basics', description: 'Business + niche' },
  { id: 'goal', title: 'Goal', description: 'Conversion setup' },
  { id: 'offers', title: 'Offers', description: 'What you promote' },
  { id: 'audience', title: 'Audience', description: 'Customer + pain points' },
  { id: 'brand', title: 'Brand', description: 'Voice + content' },
  { id: 'proof', title: 'Proof', description: 'Credibility + competitors' },
  { id: 'channels', title: 'Channels', description: 'Platforms + cadence' },
  { id: 'review', title: 'Review', description: 'Generate strategy' },
];

interface OnboardingState {
  profile: Partial<OnboardingProfile>;
  meta: OnboardingV5Meta;
  activeSection: V5SectionId;
  isLoading: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  scan: {
    loading: boolean;
    result: V5ScanResult | null;
  };
}

type OnboardingAction =
  | { type: 'SET_PROFILE'; payload: Partial<OnboardingProfile> }
  | { type: 'UPDATE_PROFILE'; payload: Partial<OnboardingProfile> }
  | { type: 'SET_META'; payload: Partial<OnboardingV5Meta> }
  | { type: 'SET_SECTION'; payload: V5SectionId }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVE_STATUS'; payload: OnboardingState['saveStatus'] }
  | { type: 'SET_SCAN_LOADING'; payload: boolean }
  | { type: 'SET_SCAN_RESULT'; payload: V5ScanResult | null };

const initialState: OnboardingState = {
  profile: {},
  meta: {},
  activeSection: 'basics',
  isLoading: true,
  saveStatus: 'idle',
  scan: { loading: false, result: null },
};

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: action.payload };
    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case 'SET_META':
      return { ...state, meta: { ...state.meta, ...action.payload } };
    case 'SET_SECTION':
      return { ...state, activeSection: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.payload };
    case 'SET_SCAN_LOADING':
      return { ...state, scan: { ...state.scan, loading: action.payload } };
    case 'SET_SCAN_RESULT':
      return { ...state, scan: { ...state.scan, result: action.payload } };
    default:
      return state;
  }
}

function cleanPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
}

function inferPlatformsFromLinks(links: string[] | null | undefined): SocialChannel[] {
  if (!links) return [];
  const lower = links.map((link) => link.toLowerCase());
  const platforms: SocialChannel[] = [];
  if (lower.some((link) => link.includes('instagram'))) platforms.push('instagram');
  if (lower.some((link) => link.includes('tiktok'))) platforms.push('tiktok');
  if (lower.some((link) => link.includes('linkedin'))) platforms.push('linkedin');
  if (lower.some((link) => link.includes('facebook'))) platforms.push('facebook');
  if (lower.some((link) => link.includes('youtube'))) platforms.push('youtube');
  if (lower.some((link) => link.includes('pinterest'))) platforms.push('pinterest');
  if (lower.some((link) => link.includes('x.com') || link.includes('twitter'))) platforms.push('x');
  return platforms;
}

function mapConversionPath(value: string | undefined): OnboardingProfile['conversion_path'] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes('call')) return 'book_call';
  if (normalized.includes('appointment') || normalized.includes('book')) return 'book_appointment';
  if (normalized.includes('dm') || normalized.includes('message')) return 'dm_keyword';
  if (normalized.includes('whatsapp')) return 'whatsapp';
  if (normalized.includes('checkout') || normalized.includes('purchase')) return 'website_checkout';
  if (normalized.includes('visit') || normalized.includes('store')) return 'visit_store';
  return undefined;
}

function mapIndustryNiche(value?: string): OnboardingProfile['industry_niche'] | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes('restaurant') || normalized.includes('cafe')) return 'restaurant_cafe';
  if (normalized.includes('gym') || normalized.includes('fitness')) return 'gym_fitness_studio';
  if (normalized.includes('salon') || normalized.includes('barber')) return 'beauty_salon_barber';
  if (normalized.includes('clinic') || normalized.includes('dentist') || normalized.includes('medical')) return 'clinic_medical';
  if (normalized.includes('real estate')) return 'real_estate';
  if (normalized.includes('education') || normalized.includes('tutor')) return 'education_tutors';
  if (normalized.includes('home service') || normalized.includes('plumber') || normalized.includes('solar')) return 'home_services';
  if (normalized.includes('ecommerce') || normalized.includes('dtc')) return 'ecommerce_dtc';
  if (normalized.includes('law') || normalized.includes('accounting') || normalized.includes('consulting')) return 'b2b_service';
  if (normalized.includes('saas') || normalized.includes('tech')) return 'saas_tech';
  return 'other';
}

export function OnboardingV5Wizard({
  clientId,
  agencyId,
  autosaveDelayMs = 700,
}: {
  clientId: string;
  agencyId: string;
  autosaveDelayMs?: number;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, dispatch] = useReducer(onboardingReducer, initialState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scanReviewOpen, setScanReviewOpen] = useState(false);
  const pendingFocusRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const rightRailKey = `onboarding_right_rail_${agencyId}_${clientId}`;
  const reviewExpandKey = `onboarding_review_expand_once_${agencyId}_${clientId}`;
  const [rightRailCollapsed, setRightRailCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(rightRailKey);
    if (stored == null) return true;
    return stored !== 'expanded';
  });

  const progress = useMemo(() => getV5ProgressSummary(state.profile), [state.profile]);

  const sectionItems = useMemo(() => {
    return SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      percent: progress.perSection[section.id]?.percent ?? 0,
      requiredCompleted: progress.requiredPerSection[section.id]?.completed ?? 0,
      requiredTotal: progress.requiredPerSection[section.id]?.total ?? 0,
    }));
  }, [progress]);

  const saveProfile = useCallback(
    async (sectionOverride?: V5SectionId) => {
      if (!clientId || state.isLoading) return;
      dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });

      const targetSection = sectionOverride ?? state.activeSection;
      const sectionIndex = SECTIONS.findIndex((section) => section.id === targetSection);
      const blockers = progress.missingFields.map((field) => ({
        field,
        message: `${getFieldLabel(field)} is required`,
      }));

      const payload = cleanPayload({
        ...state.profile,
        v5_meta: {
          ...state.meta,
          progress: {
            active_section: targetSection,
            completed_sections: Object.values(progress.perSection)
              .filter((item) => item.percent === 100)
              .map((item) => item.sectionId),
            percent_complete: progress.totalPercent,
            updated_at: new Date().toISOString(),
          },
        },
        readiness_score: progress.totalPercent,
        blockers,
        current_step: sectionIndex >= 0 ? sectionIndex + 1 : 1,
        flow_type: state.profile.flow_type ?? 'agency_led',
        updated_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('client_onboarding_profiles')
        .update(payload)
        .eq('client_id', clientId);

      if (error) {
        dispatch({ type: 'SET_SAVE_STATUS', payload: 'error' });
        trackOnboardingEvent('onboarding_autosave_error', { client_id: clientId, message: error.message });
        return;
      }

      dispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
      trackOnboardingEvent('onboarding_autosave_success', { client_id: clientId });
    },
    [clientId, progress, state.activeSection, state.isLoading, state.meta, state.profile]
  );

  const scheduleSave = useCallback(
    (sectionOverride?: V5SectionId) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void saveProfile(sectionOverride);
      }, autosaveDelayMs);
    },
    [autosaveDelayMs, saveProfile]
  );

  const flushSave = useCallback(
    async (sectionOverride?: V5SectionId) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await saveProfile(sectionOverride);
    },
    [saveProfile]
  );

  useEffect(() => {
    async function loadProfile() {
      dispatch({ type: 'SET_LOADING', payload: true });
      const { data, error } = await supabase
        .from('client_onboarding_profiles')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) {
        toast({ title: 'Error', description: 'Failed to load onboarding profile.', variant: 'destructive' });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      if (!data) {
        const { error: createError } = await supabase.rpc('upsert_onboarding_profile', {
          p_client_id: clientId,
          p_agency_id: agencyId,
          p_flow_type: 'agency_led',
          p_current_step: 1,
          p_profile_data: {},
        });

        if (createError) {
          toast({ title: 'Error', description: 'Failed to create onboarding profile.', variant: 'destructive' });
          dispatch({ type: 'SET_LOADING', payload: false });
          return;
        }
      }

      const profile = (data ?? {
        client_id: clientId,
        agency_id: agencyId,
        flow_type: 'agency_led',
        current_step: 1,
        readiness_score: 0,
        blockers: [],
      }) as Partial<OnboardingProfile>;
      const meta = (profile.v5_meta ?? {}) as OnboardingV5Meta;
      const candidate = meta.progress?.active_section as string | undefined;
      const validSections = new Set(SECTIONS.map((section) => section.id));
      const legacyMap: Record<string, V5SectionId> = {
        offer: 'offers',
      };
      const mappedCandidate = candidate ? legacyMap[candidate] ?? candidate : undefined;
      const activeSection =
        mappedCandidate && validSections.has(mappedCandidate as V5SectionId)
          ? (mappedCandidate as V5SectionId)
          : 'basics';

      dispatch({ type: 'SET_PROFILE', payload: profile });
      dispatch({ type: 'SET_META', payload: meta });
      dispatch({ type: 'SET_SECTION', payload: activeSection });
      dispatch({ type: 'SET_LOADING', payload: false });
      hasLoadedRef.current = true;

      trackOnboardingEvent('onboarding_started', { client_id: clientId });
    }

    void loadProfile();
  }, [agencyId, clientId, toast]);

  useEffect(() => {
    if (!hasLoadedRef.current || state.isLoading) return;
    scheduleSave();
  }, [state.profile, state.meta, scheduleSave, state.isLoading]);

  useEffect(() => {
    trackOnboardingEvent('onboarding_section_viewed', {
      client_id: clientId,
      section: state.activeSection,
    });

    if (state.activeSection === 'review') {
      if (typeof window !== 'undefined') {
        const expandedOnce = window.sessionStorage.getItem(reviewExpandKey);
        if (!expandedOnce) {
          setRightRailCollapsed(false);
          window.sessionStorage.setItem(reviewExpandKey, 'expanded');
          trackOnboardingEvent('onboarding_preview_expanded', { client_id: clientId, source: 'review_auto' });
        }
      }
    }

    if (pendingFocusRef.current) {
      const fieldKey = pendingFocusRef.current;
      pendingFocusRef.current = null;
      requestAnimationFrame(() => {
        const target = document.querySelector(`[data-field-key="${fieldKey}"]`) as HTMLElement | null;
        target?.focus();
      });
    }
  }, [clientId, state.activeSection, reviewExpandKey]);

  const updateField = useCallback(
    (updates: Partial<OnboardingProfile>) => {
      dispatch({ type: 'UPDATE_PROFILE', payload: updates });
      const fieldKey = Object.keys(updates)[0];
      if (fieldKey) {
        trackOnboardingEvent('onboarding_field_changed', {
          client_id: clientId,
          field: fieldKey,
        });
      }
    },
    [clientId]
  );

  const updateMeta = useCallback((updates: Partial<OnboardingV5Meta>) => {
    dispatch({ type: 'SET_META', payload: updates });
  }, []);

  const handleSectionChange = useCallback(
    async (sectionId: V5SectionId, fieldKey?: string) => {
      pendingFocusRef.current = fieldKey ?? null;
      await flushSave(sectionId);
      dispatch({ type: 'SET_SECTION', payload: sectionId });
    },
    [flushSave]
  );

  const goToNextSection = useCallback(async () => {
    const currentIndex = SECTIONS.findIndex((section) => section.id === state.activeSection);
    const nextSection = SECTIONS[Math.min(currentIndex + 1, SECTIONS.length - 1)];
    await handleSectionChange(nextSection.id);
  }, [handleSectionChange, state.activeSection]);

  const goToPreviousSection = useCallback(async () => {
    const currentIndex = SECTIONS.findIndex((section) => section.id === state.activeSection);
    const prevSection = SECTIONS[Math.max(currentIndex - 1, 0)];
    await handleSectionChange(prevSection.id);
  }, [handleSectionChange, state.activeSection]);

  const runScan = useCallback(async () => {
    const website = state.profile.q2_website?.trim();
    const socials = state.profile.q2_social_links ?? [];
    const fallback = socials.find((link) => link.trim().length > 0);
    const source = website || fallback;
    if (!source) return;

    dispatch({ type: 'SET_SCAN_LOADING', payload: true });
    trackOnboardingEvent('onboarding_scan_started', { client_id: clientId });

    const { data, error } = await supabase.functions.invoke('ai-onboarding-scan', {
      body: {
        agency_id: agencyId,
        client_id: clientId,
        website: source,
        social_links: socials,
      },
    });

    if (error) {
      dispatch({ type: 'SET_SCAN_LOADING', payload: false });
      toast({ title: 'Scan failed', description: 'Unable to scan the website.', variant: 'destructive' });
      return;
    }

    const scanResult = data as {
      extracted?: {
        niche?: string;
        audience?: string[];
        offers?: string[];
        differentiators?: string[];
        pain_points?: string[];
        cta?: string;
      };
      confidence?: number;
      source_urls?: string[];
    };

    const mapped: V5ScanResult = {
      industry_niche: mapIndustryNiche(scanResult.extracted?.niche),
      offer_ideas: scanResult.extracted?.offers ?? [],
      primary_customer: scanResult.extracted?.audience ?? [],
      pain_points: scanResult.extracted?.pain_points ?? [],
      proof_cues: scanResult.extracted?.differentiators ?? [],
      recommended_platforms: inferPlatformsFromLinks(state.profile.q2_social_links),
      conversion_path: mapConversionPath(scanResult.extracted?.cta),
      confidence: scanResult.confidence,
      source_urls: scanResult.source_urls,
    };

    dispatch({ type: 'SET_SCAN_RESULT', payload: mapped });
    dispatch({ type: 'SET_SCAN_LOADING', payload: false });
    setScanReviewOpen(true);

    updateMeta({
      last_scan: {
        timestamp: new Date().toISOString(),
        confidence: mapped.confidence,
        applied_fields_count: 0,
      },
    });

    trackOnboardingEvent('onboarding_scan_completed', { client_id: clientId, confidence: mapped.confidence });
  }, [agencyId, clientId, state.profile.q2_social_links, state.profile.q2_website, toast, updateMeta]);

  const applyScanField = useCallback(
    (fieldKey: string) => {
      const scan = state.scan.result;
      if (!scan) return;

      const updates: Partial<OnboardingProfile> = {};

      if (fieldKey === 'industry_niche' && scan.industry_niche) {
        updates.industry_niche = scan.industry_niche;
      }
      if (fieldKey === 'offers' && scan.offer_ideas?.length) {
        updates.offers = [
          {
            type: 'best_seller',
            name: scan.offer_ideas[0],
          },
        ];
        updates.q6_offer_name = scan.offer_ideas[0];
      }
      if (fieldKey === 'primary_customer' && scan.primary_customer?.length) {
        updates.primary_customer = scan.primary_customer[0];
        updates.q8_ideal_customer = scan.primary_customer[0];
      }
      if (fieldKey === 'q9_pain_points' && scan.pain_points?.length) {
        updates.q9_pain_points = scan.pain_points.slice(0, 3);
      }
      if (fieldKey === 'q13_differentiators' && scan.proof_cues?.length) {
        updates.q13_differentiators = scan.proof_cues.slice(0, 4);
      }
      if (fieldKey === 'platforms' && scan.recommended_platforms?.length) {
        updates.platforms = scan.recommended_platforms;
        updates.q16_enabled_channels = scan.recommended_platforms;
      }
      if (fieldKey === 'conversion_path' && scan.conversion_path) {
        updates.conversion_path = scan.conversion_path;
      }

      if (Object.keys(updates).length === 0) return;

      updateField(updates);

      const appliedCount = (state.meta.last_scan?.applied_fields_count ?? 0) + 1;
      updateMeta({
        last_scan: {
          ...state.meta.last_scan,
          applied_fields_count: appliedCount,
        },
      });

      trackOnboardingEvent('onboarding_scan_applied', {
        client_id: clientId,
        field: fieldKey,
      });
    },
    [clientId, state.meta.last_scan, state.scan.result, updateField, updateMeta]
  );

  const applyScanAll = useCallback(() => {
    const scan = state.scan.result;
    if (!scan) return;

    const updates: Partial<OnboardingProfile> = {};
    let appliedCount = 0;

    if (!state.profile.industry_niche && scan.industry_niche) {
      updates.industry_niche = scan.industry_niche;
      appliedCount += 1;
    }
    if (!(state.profile.offers?.length) && scan.offer_ideas?.length) {
      updates.offers = [{ type: 'best_seller', name: scan.offer_ideas[0] }];
      updates.q6_offer_name = scan.offer_ideas[0];
      appliedCount += 1;
    }
    if (!state.profile.primary_customer && scan.primary_customer?.length) {
      updates.primary_customer = scan.primary_customer[0];
      updates.q8_ideal_customer = scan.primary_customer[0];
      appliedCount += 1;
    }
    if (!(state.profile.q9_pain_points?.length) && scan.pain_points?.length) {
      updates.q9_pain_points = scan.pain_points.slice(0, 3);
      appliedCount += 1;
    }
    if (!(state.profile.q13_differentiators?.length) && scan.proof_cues?.length) {
      updates.q13_differentiators = scan.proof_cues.slice(0, 4);
      appliedCount += 1;
    }
    if (!(state.profile.platforms?.length) && scan.recommended_platforms?.length) {
      updates.platforms = scan.recommended_platforms;
      updates.q16_enabled_channels = scan.recommended_platforms;
      appliedCount += 1;
    }
    if (!state.profile.conversion_path && scan.conversion_path) {
      updates.conversion_path = scan.conversion_path;
      appliedCount += 1;
    }

    if (appliedCount > 0) {
      updateField(updates);
      updateMeta({
        last_scan: {
          ...state.meta.last_scan,
          applied_fields_count: (state.meta.last_scan?.applied_fields_count ?? 0) + appliedCount,
        },
      });
    }

    trackOnboardingEvent('onboarding_scan_applied', {
      client_id: clientId,
      field: 'apply_all',
      applied_count: appliedCount,
    });
  }, [clientId, state.meta.last_scan, state.profile, state.scan.result, updateField, updateMeta]);

  const generateStrategy = useCallback(async () => {
    if (!clientId || !agencyId) return;
    setIsGenerating(true);
    trackOnboardingEvent('onboarding_generate_clicked', { client_id: clientId });

    try {
      const { error } = await supabase.rpc('complete_onboarding_profile', {
        p_client_id: clientId,
      });

      if (error) throw error;

      const offers = state.profile.offers ?? [];
      const primaryOffer = offers[0];
      const pricing =
        typeof primaryOffer?.price_min === 'number' || typeof primaryOffer?.price_max === 'number'
          ? `${primaryOffer?.price_min ?? ''}${primaryOffer?.price_min != null && primaryOffer?.price_max != null ? '-' : ''}${primaryOffer?.price_max ?? ''}`.trim()
          : '';

      const goalLabel =
        ONBOARDING_PRIMARY_GOAL_OPTIONS.find((option) => option.id === state.profile.primary_goal)?.label ?? '';
      const conversionLabel =
        CONVERSION_PATH_OPTIONS.find((option) => option.id === state.profile.conversion_path)?.label ?? '';
      const ctaLabel =
        CTA_OPTIONS.find((option) => option.id === state.profile.q6_main_cta)?.label ?? state.profile.q6_main_cta ?? '';

      const rawResponses: Record<string, unknown> = {
        brand: sanitizeText(state.profile.q1_business_name ?? undefined) ?? '',
        website: sanitizeText(state.profile.q2_website ?? undefined) ?? '',
        platforms: sanitizeList(state.profile.platforms ?? state.profile.q16_enabled_channels ?? []),
        offers: sanitizeList(offers.map((offer) => offer.name)),
        differentiators: sanitizeList(state.profile.q13_differentiators ?? []),
        audience: sanitizeList([state.profile.primary_customer, ...(state.profile.q9_pain_points ?? [])]),
        goals: sanitizeList([goalLabel, conversionLabel]),
        competitors: sanitizeList([state.profile.competitor_link]),
        cta_styles: sanitizeList([ctaLabel || conversionLabel]),
        pricing: sanitizeText(pricing) ?? '',
        pillars: sanitizeList(state.profile.q13_differentiators ?? []).slice(0, 6),
      };

      const { data: createResp, error: createErr } = await supabase.functions.invoke('ai-brains-client', {
        body: {
          action: 'create',
          agency_id: agencyId,
          client_id: clientId,
          brain_json: { raw_responses: rawResponses, followup_responses: {} },
        },
      });
      if (createErr) throw createErr;

      const brainId = createResp?.brain?.id as string | undefined;
      if (!brainId) throw new Error('Client brain id missing');

      const { error: updateErr } = await supabase.functions.invoke('ai-brains-client', {
        body: {
          action: 'update',
          agency_id: agencyId,
          client_id: clientId,
          brain_id: brainId,
          brain_json: { raw_responses: rawResponses, followup_responses: {} },
        },
      });
      if (updateErr) throw updateErr;

      const { error: ingestErr } = await supabase.functions.invoke('ai-brain-ingest', {
        body: {
          scope: 'client',
          agency_id: agencyId,
          client_id: clientId,
          brain_id: brainId,
          source: 'onboarding',
          raw_responses: rawResponses,
          followup_responses: {},
        },
      });
      if (ingestErr) throw ingestErr;

      const { data: brainCheck, error: brainCheckErr } = await supabase
        .from('client_brains')
        .select('usable')
        .eq('agency_id', agencyId)
        .eq('client_id', clientId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      if (brainCheckErr || !brainCheck?.usable) {
        toast({
          variant: 'destructive',
          title: 'Profile Incomplete',
          description: 'Some required information is missing. Please review all sections.',
        });
        setIsGenerating(false);
        return;
      }

      const { data: strategyResp, error: strategyErr } = await supabase.functions.invoke('ai-strategy-generate', {
        body: { client_id: clientId },
      });
      if (strategyErr) throw strategyErr;
      if (strategyResp?.unknown) {
        throw new Error(
          Array.isArray(strategyResp?.questions) && strategyResp.questions.length > 0
            ? String(strategyResp.questions[0])
            : 'Strategy generation is not ready yet.',
        );
      }

      trackOnboardingEvent('onboarding_strategy_created', { client_id: clientId });

      toast({
        title: 'Onboarding complete',
        description: 'Your strategy is ready. Redirecting to client detail.',
      });

      navigate(`/clients/${clientId}`, { replace: true });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate strategy. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [agencyId, clientId, navigate, state.profile, toast]);

  const scanFieldStatus = useMemo(() => {
    return {
      industry_niche: { hasValue: Boolean(state.profile.industry_niche) },
      offers: { hasValue: (state.profile.offers?.length ?? 0) > 0 },
      primary_customer: { hasValue: Boolean(state.profile.primary_customer) },
      q9_pain_points: { hasValue: (state.profile.q9_pain_points?.length ?? 0) > 0 },
      q13_differentiators: { hasValue: (state.profile.q13_differentiators?.length ?? 0) > 0 },
      platforms: { hasValue: (state.profile.platforms?.length ?? 0) > 0 },
      conversion_path: { hasValue: Boolean(state.profile.conversion_path) },
    };
  }, [state.profile]);

  const toggleRightRail = useCallback(() => {
    setRightRailCollapsed((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(rightRailKey, next ? 'collapsed' : 'expanded');
      }
      trackOnboardingEvent(next ? 'onboarding_preview_collapsed' : 'onboarding_preview_expanded', { client_id: clientId });
      return next;
    });
  }, [clientId, rightRailKey]);

  const focusField = useCallback((fieldKey: string) => {
    if (!fieldKey) return;
    pendingFocusRef.current = fieldKey;
    requestAnimationFrame(() => {
      const target = document.querySelector(`[data-field-key="${fieldKey}"]`) as HTMLElement | null;
      target?.focus();
    });
  }, []);

  const sectionRequirements = useMemo(() => {
    return getSectionRequirementSummary(state.profile, state.activeSection);
  }, [state.activeSection, state.profile]);

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const header = (
    <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Client onboarding</div>
        <div className="text-lg font-semibold">{state.profile.q1_business_name || 'New client'}</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-xs text-muted-foreground">
          {state.saveStatus === 'saving' && 'Saving.'}
          {state.saveStatus === 'saved' && 'Saved'}
          {state.saveStatus === 'error' && 'Error saving'}
        </div>
      </div>
    </div>
  );

  const nav = (
    <SectionNav items={sectionItems} activeId={state.activeSection} onSelect={(id) => void handleSectionChange(id as V5SectionId)} />
  );

  const preview = (
    <RightRail
      profile={state.profile}
      meta={state.meta}
      scan={state.scan.result}
      collapsed={rightRailCollapsed}
      onToggle={toggleRightRail}
    />
  );

  const mobileNav = (
    <div className="mb-4 lg:hidden">
      <SectionNav items={sectionItems} activeId={state.activeSection} onSelect={(id) => void handleSectionChange(id as V5SectionId)} />
    </div>
  );

  return (
    <OnboardingV5Layout header={header} nav={nav} preview={preview}>
      {mobileNav}
      {state.activeSection === 'basics' && (
        <BasicsSection
          profile={state.profile}
          scanResult={state.scan.result}
          scanLoading={state.scan.loading}
          onScan={runScan}
          scanReviewOpen={scanReviewOpen}
          onScanReviewOpenChange={setScanReviewOpen}
          onFieldChange={updateField}
          missingFields={sectionRequirements.missing}
          onFocusField={focusField}
          onNext={goToNextSection}
        />
      )}
      {state.activeSection === 'goal' && (
        <GoalSection
          profile={state.profile}
          onFieldChange={updateField}
          missingFields={sectionRequirements.missing}
          onFocusField={focusField}
          onNext={goToNextSection}
          onBack={goToPreviousSection}
        />
      )}
      {state.activeSection === 'offers' && (
        <OffersSection
          profile={state.profile}
          onFieldChange={updateField}
          missingFields={sectionRequirements.missing}
          onFocusField={focusField}
          onNext={goToNextSection}
          onBack={goToPreviousSection}
        />
      )}
      {state.activeSection === 'audience' && (
        <AudienceSection
          profile={state.profile}
          onFieldChange={updateField}
          missingFields={sectionRequirements.missing}
          onFocusField={focusField}
          onNext={goToNextSection}
          onBack={goToPreviousSection}
        />
      )}
      {state.activeSection === 'brand' && (
        <BrandSection
          profile={state.profile}
          onFieldChange={updateField}
          missingFields={sectionRequirements.missing}
          onFocusField={focusField}
          onNext={goToNextSection}
          onBack={goToPreviousSection}
        />
      )}
      {state.activeSection === 'proof' && (
        <ProofSection
          profile={state.profile}
          onFieldChange={updateField}
          missingFields={sectionRequirements.missing}
          onFocusField={focusField}
          onNext={goToNextSection}
          onBack={goToPreviousSection}
        />
      )}
      {state.activeSection === 'channels' && (
        <ChannelsSection
          profile={state.profile}
          onFieldChange={updateField}
          missingFields={sectionRequirements.missing}
          onFocusField={focusField}
          onNext={goToNextSection}
          onBack={goToPreviousSection}
        />
      )}
      {state.activeSection === 'review' && (
        <ReviewSection
          profile={state.profile}
          isGenerating={isGenerating}
          onGenerate={generateStrategy}
          onBack={goToPreviousSection}
          onNavigate={(sectionId, fieldKey) => void handleSectionChange(sectionId as V5SectionId, fieldKey)}
        />
      )}
      <AIScanReviewDialog
        open={scanReviewOpen}
        onOpenChange={setScanReviewOpen}
        isLoading={state.scan.loading}
        scanResult={state.scan.result}
        onApplyAll={applyScanAll}
        onApplyField={applyScanField}
        fieldStatus={scanFieldStatus}
      />
    </OnboardingV5Layout>
  );
}
