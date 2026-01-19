# A7 — Onboarding to Strategy Pipeline (Current Truth)

## Purpose
Audit the V5 onboarding completion sequence and how it transitions into a usable client brain and strategy generation. This matters because strategy generation requires `client_brains.usable=true` plus sufficient RAG context.

## Key Findings Summary
- V5 onboarding is implemented in `src/components/onboarding-v5/OnboardingV5Wizard.tsx`.
- The onboarding flow calls AI endpoints (`ai-brains-client`, `ai-brain-ingest`, and strategy generation) to create/update the client brain and generate strategy.
- The `ai-brain-ingest` step is critical because it computes and stores `client_brains.usable` using `evaluateClientBrainForStrategy()`.
- Any failure in the completion sequence must be surfaced; otherwise clients end up “onboarded” but not strategy-eligible.

## Detailed Analysis
### Completion sequence (observed)
- At completion, the wizard persists onboarding profile data and then triggers the AI brain pipeline.
- Strategy generation can be triggered after ingestion, but it must handle gated responses (`unknown: true`) and show actionable guidance.

### Failure modes
- If `ai-brain-ingest` fails or is skipped, `client_brains.usable` may remain false, causing strategy generation to return a gated response.
- If strategy generation fails (missing API keys, RAG failures, timeout), the user should still land in a sensible UI state with instructions.

## Code Evidence
### Full File (line-numbered): `src/components/onboarding-v5/OnboardingV5Wizard.tsx`

```text
    1: import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
    2: import { useNavigate } from 'react-router-dom';
    3: import { useToast } from '@/hooks/use-toast';
    4: import { supabase } from '@/integrations/supabase/client';
    5: import type { OnboardingProfile, OnboardingV5Meta, V5ScanResult, SocialChannel } from '@/types/onboarding';
    6: import { CTA_OPTIONS, CONVERSION_PATH_OPTIONS, ONBOARDING_PRIMARY_GOAL_OPTIONS } from '@/types/onboarding';
    7: import { OnboardingV5Layout } from './OnboardingV5Layout';
    8: import { SectionNav } from './components/SectionNav';
    9: import { RightRail } from './components/RightRail';
   10: import { AIScanReviewDialog } from './components/AIScanReviewDialog';
   11: import { BasicsSection } from './sections/BasicsSection';
   12: import { GoalSection } from './sections/GoalSection';
   13: import { OffersSection } from './sections/OffersSection';
   14: import { AudienceSection } from './sections/AudienceSection';
   15: import { BrandSection } from './sections/BrandSection';
   16: import { ProofSection } from './sections/ProofSection';
   17: import { ChannelsSection } from './sections/ChannelsSection';
   18: import { ReviewSection } from './sections/ReviewSection';
   19: import { getSectionRequirementSummary, getV5ProgressSummary, type V5SectionId } from './lib/progress';
   20: import { sanitizeList, sanitizeText } from './lib/sanitize';
   21: import { trackOnboardingEvent } from './lib/events';
   22: import { getFieldLabel } from './lib/labels';
   23: import { Skeleton } from '@/components/ui/skeleton';
   24: 
   25: const SECTIONS: Array<{ id: V5SectionId; title: string; description: string }> = [
   26:   { id: 'basics', title: 'Basics', description: 'Business + niche' },
   27:   { id: 'goal', title: 'Goal', description: 'Conversion setup' },
   28:   { id: 'offers', title: 'Offers', description: 'What you promote' },
   29:   { id: 'audience', title: 'Audience', description: 'Customer + pain points' },
   30:   { id: 'brand', title: 'Brand', description: 'Voice + content' },
   31:   { id: 'proof', title: 'Proof', description: 'Credibility + competitors' },
   32:   { id: 'channels', title: 'Channels', description: 'Platforms + cadence' },
   33:   { id: 'review', title: 'Review', description: 'Generate strategy' },
   34: ];
   35: 
   36: interface OnboardingState {
   37:   profile: Partial<OnboardingProfile>;
   38:   meta: OnboardingV5Meta;
   39:   activeSection: V5SectionId;
   40:   isLoading: boolean;
   41:   saveStatus: 'idle' | 'saving' | 'saved' | 'error';
   42:   scan: {
   43:     loading: boolean;
   44:     result: V5ScanResult | null;
   45:   };
   46: }
   47: 
   48: type OnboardingAction =
   49:   | { type: 'SET_PROFILE'; payload: Partial<OnboardingProfile> }
   50:   | { type: 'UPDATE_PROFILE'; payload: Partial<OnboardingProfile> }
   51:   | { type: 'SET_META'; payload: Partial<OnboardingV5Meta> }
   52:   | { type: 'SET_SECTION'; payload: V5SectionId }
   53:   | { type: 'SET_LOADING'; payload: boolean }
   54:   | { type: 'SET_SAVE_STATUS'; payload: OnboardingState['saveStatus'] }
   55:   | { type: 'SET_SCAN_LOADING'; payload: boolean }
   56:   | { type: 'SET_SCAN_RESULT'; payload: V5ScanResult | null };
   57: 
   58: const initialState: OnboardingState = {
   59:   profile: {},
   60:   meta: {},
   61:   activeSection: 'basics',
   62:   isLoading: true,
   63:   saveStatus: 'idle',
   64:   scan: { loading: false, result: null },
   65: };
   66: 
   67: function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
   68:   switch (action.type) {
   69:     case 'SET_PROFILE':
   70:       return { ...state, profile: action.payload };
   71:     case 'UPDATE_PROFILE':
   72:       return { ...state, profile: { ...state.profile, ...action.payload } };
   73:     case 'SET_META':
   74:       return { ...state, meta: { ...state.meta, ...action.payload } };
   75:     case 'SET_SECTION':
   76:       return { ...state, activeSection: action.payload };
   77:     case 'SET_LOADING':
   78:       return { ...state, isLoading: action.payload };
   79:     case 'SET_SAVE_STATUS':
   80:       return { ...state, saveStatus: action.payload };
   81:     case 'SET_SCAN_LOADING':
   82:       return { ...state, scan: { ...state.scan, loading: action.payload } };
   83:     case 'SET_SCAN_RESULT':
   84:       return { ...state, scan: { ...state.scan, result: action.payload } };
   85:     default:
   86:       return state;
   87:   }
   88: }
   89: 
   90: function cleanPayload<T extends Record<string, unknown>>(payload: T): T {
   91:   return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as T;
   92: }
   93: 
   94: function inferPlatformsFromLinks(links: string[] | null | undefined): SocialChannel[] {
   95:   if (!links) return [];
   96:   const lower = links.map((link) => link.toLowerCase());
   97:   const platforms: SocialChannel[] = [];
   98:   if (lower.some((link) => link.includes('instagram'))) platforms.push('instagram');
   99:   if (lower.some((link) => link.includes('tiktok'))) platforms.push('tiktok');
  100:   if (lower.some((link) => link.includes('linkedin'))) platforms.push('linkedin');
  101:   if (lower.some((link) => link.includes('facebook'))) platforms.push('facebook');
  102:   if (lower.some((link) => link.includes('youtube'))) platforms.push('youtube');
  103:   if (lower.some((link) => link.includes('pinterest'))) platforms.push('pinterest');
  104:   if (lower.some((link) => link.includes('x.com') || link.includes('twitter'))) platforms.push('x');
  105:   return platforms;
  106: }
  107: 
  108: function mapConversionPath(value: string | undefined): OnboardingProfile['conversion_path'] | undefined {
  109:   if (!value) return undefined;
  110:   const normalized = value.toLowerCase();
  111:   if (normalized.includes('call')) return 'book_call';
  112:   if (normalized.includes('appointment') || normalized.includes('book')) return 'book_appointment';
  113:   if (normalized.includes('dm') || normalized.includes('message')) return 'dm_keyword';
  114:   if (normalized.includes('whatsapp')) return 'whatsapp';
  115:   if (normalized.includes('checkout') || normalized.includes('purchase')) return 'website_checkout';
  116:   if (normalized.includes('visit') || normalized.includes('store')) return 'visit_store';
  117:   return undefined;
  118: }
  119: 
  120: function mapIndustryNiche(value?: string): OnboardingProfile['industry_niche'] | undefined {
  121:   if (!value) return undefined;
  122:   const normalized = value.toLowerCase();
  123:   if (normalized.includes('restaurant') || normalized.includes('cafe')) return 'restaurant_cafe';
  124:   if (normalized.includes('gym') || normalized.includes('fitness')) return 'gym_fitness_studio';
  125:   if (normalized.includes('salon') || normalized.includes('barber')) return 'beauty_salon_barber';
  126:   if (normalized.includes('clinic') || normalized.includes('dentist') || normalized.includes('medical')) return 'clinic_medical';
  127:   if (normalized.includes('real estate')) return 'real_estate';
  128:   if (normalized.includes('education') || normalized.includes('tutor')) return 'education_tutors';
  129:   if (normalized.includes('home service') || normalized.includes('plumber') || normalized.includes('solar')) return 'home_services';
  130:   if (normalized.includes('ecommerce') || normalized.includes('dtc')) return 'ecommerce_dtc';
  131:   if (normalized.includes('law') || normalized.includes('accounting') || normalized.includes('consulting')) return 'b2b_service';
  132:   if (normalized.includes('saas') || normalized.includes('tech')) return 'saas_tech';
  133:   return 'other';
  134: }
  135: 
  136: export function OnboardingV5Wizard({
  137:   clientId,
  138:   agencyId,
  139:   autosaveDelayMs = 700,
  140: }: {
  141:   clientId: string;
  142:   agencyId: string;
  143:   autosaveDelayMs?: number;
  144: }) {
  145:   const navigate = useNavigate();
  146:   const { toast } = useToast();
  147:   const [state, dispatch] = useReducer(onboardingReducer, initialState);
  148:   const [isGenerating, setIsGenerating] = useState(false);
  149:   const [scanReviewOpen, setScanReviewOpen] = useState(false);
  150:   const pendingFocusRef = useRef<string | null>(null);
  151:   const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  152:   const hasLoadedRef = useRef(false);
  153:   const rightRailKey = `onboarding_right_rail_${agencyId}_${clientId}`;
  154:   const reviewExpandKey = `onboarding_review_expand_once_${agencyId}_${clientId}`;
  155:   const [rightRailCollapsed, setRightRailCollapsed] = useState(() => {
  156:     if (typeof window === 'undefined') return true;
  157:     const stored = window.localStorage.getItem(rightRailKey);
  158:     if (stored == null) return true;
  159:     return stored !== 'expanded';
  160:   });
  161: 
  162:   const progress = useMemo(() => getV5ProgressSummary(state.profile), [state.profile]);
  163: 
  164:   const sectionItems = useMemo(() => {
  165:     return SECTIONS.map((section) => ({
  166:       id: section.id,
  167:       title: section.title,
  168:       description: section.description,
  169:       percent: progress.perSection[section.id]?.percent ?? 0,
  170:       requiredCompleted: progress.requiredPerSection[section.id]?.completed ?? 0,
  171:       requiredTotal: progress.requiredPerSection[section.id]?.total ?? 0,
  172:     }));
  173:   }, [progress]);
  174: 
  175:   const saveProfile = useCallback(
  176:     async (sectionOverride?: V5SectionId) => {
  177:       if (!clientId || state.isLoading) return;
  178:       dispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
  179: 
  180:       const targetSection = sectionOverride ?? state.activeSection;
  181:       const sectionIndex = SECTIONS.findIndex((section) => section.id === targetSection);
  182:       const blockers = progress.missingFields.map((field) => ({
  183:         field,
  184:         message: `${getFieldLabel(field)} is required`,
  185:       }));
  186: 
  187:       const payload = cleanPayload({
  188:         ...state.profile,
  189:         v5_meta: {
  190:           ...state.meta,
  191:           progress: {
  192:             active_section: targetSection,
  193:             completed_sections: Object.values(progress.perSection)
  194:               .filter((item) => item.percent === 100)
  195:               .map((item) => item.sectionId),
  196:             percent_complete: progress.totalPercent,
  197:             updated_at: new Date().toISOString(),
  198:           },
  199:         },
  200:         readiness_score: progress.totalPercent,
  201:         blockers,
  202:         current_step: sectionIndex >= 0 ? sectionIndex + 1 : 1,
  203:         flow_type: state.profile.flow_type ?? 'agency_led',
  204:         updated_at: new Date().toISOString(),
  205:       });
  206: 
  207:       const { error } = await supabase
  208:         .from('client_onboarding_profiles')
  209:         .update(payload)
  210:         .eq('client_id', clientId);
  211: 
  212:       if (error) {
  213:         dispatch({ type: 'SET_SAVE_STATUS', payload: 'error' });
  214:         trackOnboardingEvent('onboarding_autosave_error', { client_id: clientId, message: error.message });
  215:         return;
  216:       }
  217: 
  218:       dispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
  219:       trackOnboardingEvent('onboarding_autosave_success', { client_id: clientId });
  220:     },
  221:     [clientId, progress, state.activeSection, state.isLoading, state.meta, state.profile]
  222:   );
  223: 
  224:   const scheduleSave = useCallback(
  225:     (sectionOverride?: V5SectionId) => {
  226:       if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  227:       saveTimerRef.current = setTimeout(() => {
  228:         void saveProfile(sectionOverride);
  229:       }, autosaveDelayMs);
  230:     },
  231:     [autosaveDelayMs, saveProfile]
  232:   );
  233: 
  234:   const flushSave = useCallback(
  235:     async (sectionOverride?: V5SectionId) => {
  236:       if (saveTimerRef.current) {
  237:         clearTimeout(saveTimerRef.current);
  238:         saveTimerRef.current = null;
  239:       }
  240:       await saveProfile(sectionOverride);
  241:     },
  242:     [saveProfile]
  243:   );
  244: 
  245:   useEffect(() => {
  246:     async function loadProfile() {
  247:       dispatch({ type: 'SET_LOADING', payload: true });
  248:       const { data, error } = await supabase
  249:         .from('client_onboarding_profiles')
  250:         .select('*')
  251:         .eq('client_id', clientId)
  252:         .maybeSingle();
  253: 
  254:       if (error) {
  255:         toast({ title: 'Error', description: 'Failed to load onboarding profile.', variant: 'destructive' });
  256:         dispatch({ type: 'SET_LOADING', payload: false });
  257:         return;
  258:       }
  259: 
  260:       if (!data) {
  261:         const { error: createError } = await supabase.rpc('upsert_onboarding_profile', {
  262:           p_client_id: clientId,
  263:           p_agency_id: agencyId,
  264:           p_flow_type: 'agency_led',
  265:           p_current_step: 1,
  266:           p_profile_data: {},
  267:         });
  268: 
  269:         if (createError) {
  270:           toast({ title: 'Error', description: 'Failed to create onboarding profile.', variant: 'destructive' });
  271:           dispatch({ type: 'SET_LOADING', payload: false });
  272:           return;
  273:         }
  274:       }
  275: 
  276:       const profile = (data ?? {
  277:         client_id: clientId,
  278:         agency_id: agencyId,
  279:         flow_type: 'agency_led',
  280:         current_step: 1,
  281:         readiness_score: 0,
  282:         blockers: [],
  283:       }) as Partial<OnboardingProfile>;
  284:       const meta = (profile.v5_meta ?? {}) as OnboardingV5Meta;
  285:       const candidate = meta.progress?.active_section as string | undefined;
  286:       const validSections = new Set(SECTIONS.map((section) => section.id));
  287:       const legacyMap: Record<string, V5SectionId> = {
  288:         offer: 'offers',
  289:       };
  290:       const mappedCandidate = candidate ? legacyMap[candidate] ?? candidate : undefined;
  291:       const activeSection =
  292:         mappedCandidate && validSections.has(mappedCandidate as V5SectionId)
  293:           ? (mappedCandidate as V5SectionId)
  294:           : 'basics';
  295: 
  296:       dispatch({ type: 'SET_PROFILE', payload: profile });
  297:       dispatch({ type: 'SET_META', payload: meta });
  298:       dispatch({ type: 'SET_SECTION', payload: activeSection });
  299:       dispatch({ type: 'SET_LOADING', payload: false });
  300:       hasLoadedRef.current = true;
  301: 
  302:       trackOnboardingEvent('onboarding_started', { client_id: clientId });
  303:     }
  304: 
  305:     void loadProfile();
  306:   }, [agencyId, clientId, toast]);
  307: 
  308:   useEffect(() => {
  309:     if (!hasLoadedRef.current || state.isLoading) return;
  310:     scheduleSave();
  311:   }, [state.profile, state.meta, scheduleSave, state.isLoading]);
  312: 
  313:   useEffect(() => {
  314:     trackOnboardingEvent('onboarding_section_viewed', {
  315:       client_id: clientId,
  316:       section: state.activeSection,
  317:     });
  318: 
  319:     if (state.activeSection === 'review') {
  320:       if (typeof window !== 'undefined') {
  321:         const expandedOnce = window.sessionStorage.getItem(reviewExpandKey);
  322:         if (!expandedOnce) {
  323:           setRightRailCollapsed(false);
  324:           window.sessionStorage.setItem(reviewExpandKey, 'expanded');
  325:           trackOnboardingEvent('onboarding_preview_expanded', { client_id: clientId, source: 'review_auto' });
  326:         }
  327:       }
  328:     }
  329: 
  330:     if (pendingFocusRef.current) {
  331:       const fieldKey = pendingFocusRef.current;
  332:       pendingFocusRef.current = null;
  333:       requestAnimationFrame(() => {
  334:         const target = document.querySelector(`[data-field-key="${fieldKey}"]`) as HTMLElement | null;
  335:         target?.focus();
  336:       });
  337:     }
  338:   }, [clientId, state.activeSection, reviewExpandKey]);
  339: 
  340:   const updateField = useCallback(
  341:     (updates: Partial<OnboardingProfile>) => {
  342:       dispatch({ type: 'UPDATE_PROFILE', payload: updates });
  343:       const fieldKey = Object.keys(updates)[0];
  344:       if (fieldKey) {
  345:         trackOnboardingEvent('onboarding_field_changed', {
  346:           client_id: clientId,
  347:           field: fieldKey,
  348:         });
  349:       }
  350:     },
  351:     [clientId]
  352:   );
  353: 
  354:   const updateMeta = useCallback((updates: Partial<OnboardingV5Meta>) => {
  355:     dispatch({ type: 'SET_META', payload: updates });
  356:   }, []);
  357: 
  358:   const handleSectionChange = useCallback(
  359:     async (sectionId: V5SectionId, fieldKey?: string) => {
  360:       pendingFocusRef.current = fieldKey ?? null;
  361:       await flushSave(sectionId);
  362:       dispatch({ type: 'SET_SECTION', payload: sectionId });
  363:     },
  364:     [flushSave]
  365:   );
  366: 
  367:   const goToNextSection = useCallback(async () => {
  368:     const currentIndex = SECTIONS.findIndex((section) => section.id === state.activeSection);
  369:     const nextSection = SECTIONS[Math.min(currentIndex + 1, SECTIONS.length - 1)];
  370:     await handleSectionChange(nextSection.id);
  371:   }, [handleSectionChange, state.activeSection]);
  372: 
  373:   const goToPreviousSection = useCallback(async () => {
  374:     const currentIndex = SECTIONS.findIndex((section) => section.id === state.activeSection);
  375:     const prevSection = SECTIONS[Math.max(currentIndex - 1, 0)];
  376:     await handleSectionChange(prevSection.id);
  377:   }, [handleSectionChange, state.activeSection]);
  378: 
  379:   const runScan = useCallback(async () => {
  380:     const website = state.profile.q2_website?.trim();
  381:     const socials = state.profile.q2_social_links ?? [];
  382:     const fallback = socials.find((link) => link.trim().length > 0);
  383:     const source = website || fallback;
  384:     if (!source) return;
  385: 
  386:     dispatch({ type: 'SET_SCAN_LOADING', payload: true });
  387:     trackOnboardingEvent('onboarding_scan_started', { client_id: clientId });
  388: 
  389:     const { data, error } = await supabase.functions.invoke('ai-onboarding-scan', {
  390:       body: {
  391:         agency_id: agencyId,
  392:         client_id: clientId,
  393:         website: source,
  394:         social_links: socials,
  395:       },
  396:     });
  397: 
  398:     if (error) {
  399:       dispatch({ type: 'SET_SCAN_LOADING', payload: false });
  400:       toast({ title: 'Scan failed', description: 'Unable to scan the website.', variant: 'destructive' });
  401:       return;
  402:     }
  403: 
  404:     const scanResult = data as {
  405:       extracted?: {
  406:         niche?: string;
  407:         audience?: string[];
  408:         offers?: string[];
  409:         differentiators?: string[];
  410:         pain_points?: string[];
  411:         cta?: string;
  412:       };
  413:       confidence?: number;
  414:       source_urls?: string[];
  415:     };
  416: 
  417:     const mapped: V5ScanResult = {
  418:       industry_niche: mapIndustryNiche(scanResult.extracted?.niche),
  419:       offer_ideas: scanResult.extracted?.offers ?? [],
  420:       primary_customer: scanResult.extracted?.audience ?? [],
  421:       pain_points: scanResult.extracted?.pain_points ?? [],
  422:       proof_cues: scanResult.extracted?.differentiators ?? [],
  423:       recommended_platforms: inferPlatformsFromLinks(state.profile.q2_social_links),
  424:       conversion_path: mapConversionPath(scanResult.extracted?.cta),
  425:       confidence: scanResult.confidence,
  426:       source_urls: scanResult.source_urls,
  427:     };
  428: 
  429:     dispatch({ type: 'SET_SCAN_RESULT', payload: mapped });
  430:     dispatch({ type: 'SET_SCAN_LOADING', payload: false });
  431:     setScanReviewOpen(true);
  432: 
  433:     updateMeta({
  434:       last_scan: {
  435:         timestamp: new Date().toISOString(),
  436:         confidence: mapped.confidence,
  437:         applied_fields_count: 0,
  438:       },
  439:     });
  440: 
  441:     trackOnboardingEvent('onboarding_scan_completed', { client_id: clientId, confidence: mapped.confidence });
  442:   }, [agencyId, clientId, state.profile.q2_social_links, state.profile.q2_website, toast, updateMeta]);
  443: 
  444:   const applyScanField = useCallback(
  445:     (fieldKey: string) => {
  446:       const scan = state.scan.result;
  447:       if (!scan) return;
  448: 
  449:       const updates: Partial<OnboardingProfile> = {};
  450: 
  451:       if (fieldKey === 'industry_niche' && scan.industry_niche) {
  452:         updates.industry_niche = scan.industry_niche;
  453:       }
  454:       if (fieldKey === 'offers' && scan.offer_ideas?.length) {
  455:         updates.offers = [
  456:           {
  457:             type: 'best_seller',
  458:             name: scan.offer_ideas[0],
  459:           },
  460:         ];
  461:         updates.q6_offer_name = scan.offer_ideas[0];
  462:       }
  463:       if (fieldKey === 'primary_customer' && scan.primary_customer?.length) {
  464:         updates.primary_customer = scan.primary_customer[0];
  465:         updates.q8_ideal_customer = scan.primary_customer[0];
  466:       }
  467:       if (fieldKey === 'q9_pain_points' && scan.pain_points?.length) {
  468:         updates.q9_pain_points = scan.pain_points.slice(0, 3);
  469:       }
  470:       if (fieldKey === 'q13_differentiators' && scan.proof_cues?.length) {
  471:         updates.q13_differentiators = scan.proof_cues.slice(0, 4);
  472:       }
  473:       if (fieldKey === 'platforms' && scan.recommended_platforms?.length) {
  474:         updates.platforms = scan.recommended_platforms;
  475:         updates.q16_enabled_channels = scan.recommended_platforms;
  476:       }
  477:       if (fieldKey === 'conversion_path' && scan.conversion_path) {
  478:         updates.conversion_path = scan.conversion_path;
  479:       }
  480: 
  481:       if (Object.keys(updates).length === 0) return;
  482: 
  483:       updateField(updates);
  484: 
  485:       const appliedCount = (state.meta.last_scan?.applied_fields_count ?? 0) + 1;
  486:       updateMeta({
  487:         last_scan: {
  488:           ...state.meta.last_scan,
  489:           applied_fields_count: appliedCount,
  490:         },
  491:       });
  492: 
  493:       trackOnboardingEvent('onboarding_scan_applied', {
  494:         client_id: clientId,
  495:         field: fieldKey,
  496:       });
  497:     },
  498:     [clientId, state.meta.last_scan, state.scan.result, updateField, updateMeta]
  499:   );
  500: 
  501:   const applyScanAll = useCallback(() => {
  502:     const scan = state.scan.result;
  503:     if (!scan) return;
  504: 
  505:     const updates: Partial<OnboardingProfile> = {};
  506:     let appliedCount = 0;
  507: 
  508:     if (!state.profile.industry_niche && scan.industry_niche) {
  509:       updates.industry_niche = scan.industry_niche;
  510:       appliedCount += 1;
  511:     }
  512:     if (!(state.profile.offers?.length) && scan.offer_ideas?.length) {
  513:       updates.offers = [{ type: 'best_seller', name: scan.offer_ideas[0] }];
  514:       updates.q6_offer_name = scan.offer_ideas[0];
  515:       appliedCount += 1;
  516:     }
  517:     if (!state.profile.primary_customer && scan.primary_customer?.length) {
  518:       updates.primary_customer = scan.primary_customer[0];
  519:       updates.q8_ideal_customer = scan.primary_customer[0];
  520:       appliedCount += 1;
  521:     }
  522:     if (!(state.profile.q9_pain_points?.length) && scan.pain_points?.length) {
  523:       updates.q9_pain_points = scan.pain_points.slice(0, 3);
  524:       appliedCount += 1;
  525:     }
  526:     if (!(state.profile.q13_differentiators?.length) && scan.proof_cues?.length) {
  527:       updates.q13_differentiators = scan.proof_cues.slice(0, 4);
  528:       appliedCount += 1;
  529:     }
  530:     if (!(state.profile.platforms?.length) && scan.recommended_platforms?.length) {
  531:       updates.platforms = scan.recommended_platforms;
  532:       updates.q16_enabled_channels = scan.recommended_platforms;
  533:       appliedCount += 1;
  534:     }
  535:     if (!state.profile.conversion_path && scan.conversion_path) {
  536:       updates.conversion_path = scan.conversion_path;
  537:       appliedCount += 1;
  538:     }
  539: 
  540:     if (appliedCount > 0) {
  541:       updateField(updates);
  542:       updateMeta({
  543:         last_scan: {
  544:           ...state.meta.last_scan,
  545:           applied_fields_count: (state.meta.last_scan?.applied_fields_count ?? 0) + appliedCount,
  546:         },
  547:       });
  548:     }
  549: 
  550:     trackOnboardingEvent('onboarding_scan_applied', {
  551:       client_id: clientId,
  552:       field: 'apply_all',
  553:       applied_count: appliedCount,
  554:     });
  555:   }, [clientId, state.meta.last_scan, state.profile, state.scan.result, updateField, updateMeta]);
  556: 
  557:   const generateStrategy = useCallback(async () => {
  558:     if (!clientId || !agencyId) return;
  559:     setIsGenerating(true);
  560:     trackOnboardingEvent('onboarding_generate_clicked', { client_id: clientId });
  561: 
  562:     try {
  563:       const { error } = await supabase.rpc('complete_onboarding_profile', {
  564:         p_client_id: clientId,
  565:       });
  566: 
  567:       if (error) throw error;
  568: 
  569:       const offers = state.profile.offers ?? [];
  570:       const primaryOffer = offers[0];
  571:       const pricing =
  572:         typeof primaryOffer?.price_min === 'number' || typeof primaryOffer?.price_max === 'number'
  573:           ? `${primaryOffer?.price_min ?? ''}${primaryOffer?.price_min != null && primaryOffer?.price_max != null ? '-' : ''}${primaryOffer?.price_max ?? ''}`.trim()
  574:           : '';
  575: 
  576:       const goalLabel =
  577:         ONBOARDING_PRIMARY_GOAL_OPTIONS.find((option) => option.id === state.profile.primary_goal)?.label ?? '';
  578:       const conversionLabel =
  579:         CONVERSION_PATH_OPTIONS.find((option) => option.id === state.profile.conversion_path)?.label ?? '';
  580:       const ctaLabel =
  581:         CTA_OPTIONS.find((option) => option.id === state.profile.q6_main_cta)?.label ?? state.profile.q6_main_cta ?? '';
  582: 
  583:       const rawResponses: Record<string, unknown> = {
  584:         brand: sanitizeText(state.profile.q1_business_name ?? undefined) ?? '',
  585:         website: sanitizeText(state.profile.q2_website ?? undefined) ?? '',
  586:         platforms: sanitizeList(state.profile.platforms ?? state.profile.q16_enabled_channels ?? []),
  587:         offers: sanitizeList(offers.map((offer) => offer.name)),
  588:         differentiators: sanitizeList(state.profile.q13_differentiators ?? []),
  589:         audience: sanitizeList([state.profile.primary_customer, ...(state.profile.q9_pain_points ?? [])]),
  590:         goals: sanitizeList([goalLabel, conversionLabel]),
  591:         competitors: sanitizeList([state.profile.competitor_link]),
  592:         cta_styles: sanitizeList([ctaLabel || conversionLabel]),
  593:         pricing: sanitizeText(pricing) ?? '',
  594:         pillars: sanitizeList(state.profile.q13_differentiators ?? []).slice(0, 6),
  595:       };
  596: 
  597:       const { data: createResp, error: createErr } = await supabase.functions.invoke('ai-brains-client', {
  598:         body: {
  599:           action: 'create',
  600:           agency_id: agencyId,
  601:           client_id: clientId,
  602:           brain_json: { raw_responses: rawResponses, followup_responses: {} },
  603:         },
  604:       });
  605:       if (createErr) throw createErr;
  606: 
  607:       const brainId = createResp?.brain?.id as string | undefined;
  608:       if (!brainId) throw new Error('Client brain id missing');
  609: 
  610:       const { error: updateErr } = await supabase.functions.invoke('ai-brains-client', {
  611:         body: {
  612:           action: 'update',
  613:           agency_id: agencyId,
  614:           client_id: clientId,
  615:           brain_id: brainId,
  616:           brain_json: { raw_responses: rawResponses, followup_responses: {} },
  617:         },
  618:       });
  619:       if (updateErr) throw updateErr;
  620: 
  621:       const { error: ingestErr } = await supabase.functions.invoke('ai-brain-ingest', {
  622:         body: {
  623:           scope: 'client',
  624:           agency_id: agencyId,
  625:           client_id: clientId,
  626:           brain_id: brainId,
  627:           source: 'onboarding',
  628:           raw_responses: rawResponses,
  629:           followup_responses: {},
  630:         },
  631:       });
  632:       if (ingestErr) throw ingestErr;
  633: 
  634:       const { data: strategyResp, error: strategyErr } = await supabase.functions.invoke('ai-strategy-generate', {
  635:         body: { client_id: clientId },
  636:       });
  637:       if (strategyErr) throw strategyErr;
  638:       if (strategyResp?.unknown) {
  639:         throw new Error(
  640:           Array.isArray(strategyResp?.questions) && strategyResp.questions.length > 0
  641:             ? String(strategyResp.questions[0])
  642:             : 'Strategy generation is not ready yet.',
  643:         );
  644:       }
  645: 
  646:       trackOnboardingEvent('onboarding_strategy_created', { client_id: clientId });
  647: 
  648:       toast({
  649:         title: 'Onboarding complete',
  650:         description: 'Your strategy is ready. Redirecting to client detail.',
  651:       });
  652: 
  653:       navigate(`/clients/${clientId}`, { replace: true });
  654:     } catch (err) {
  655:       toast({
  656:         title: 'Error',
  657:         description: 'Failed to generate strategy. Please try again.',
  658:         variant: 'destructive',
  659:       });
  660:     } finally {
  661:       setIsGenerating(false);
  662:     }
  663:   }, [agencyId, clientId, navigate, state.profile, toast]);
  664: 
  665:   const scanFieldStatus = useMemo(() => {
  666:     return {
  667:       industry_niche: { hasValue: Boolean(state.profile.industry_niche) },
  668:       offers: { hasValue: (state.profile.offers?.length ?? 0) > 0 },
  669:       primary_customer: { hasValue: Boolean(state.profile.primary_customer) },
  670:       q9_pain_points: { hasValue: (state.profile.q9_pain_points?.length ?? 0) > 0 },
  671:       q13_differentiators: { hasValue: (state.profile.q13_differentiators?.length ?? 0) > 0 },
  672:       platforms: { hasValue: (state.profile.platforms?.length ?? 0) > 0 },
  673:       conversion_path: { hasValue: Boolean(state.profile.conversion_path) },
  674:     };
  675:   }, [state.profile]);
  676: 
  677:   const toggleRightRail = useCallback(() => {
  678:     setRightRailCollapsed((current) => {
  679:       const next = !current;
  680:       if (typeof window !== 'undefined') {
  681:         window.localStorage.setItem(rightRailKey, next ? 'collapsed' : 'expanded');
  682:       }
  683:       trackOnboardingEvent(next ? 'onboarding_preview_collapsed' : 'onboarding_preview_expanded', { client_id: clientId });
  684:       return next;
  685:     });
  686:   }, [clientId, rightRailKey]);
  687: 
  688:   const focusField = useCallback((fieldKey: string) => {
  689:     if (!fieldKey) return;
  690:     pendingFocusRef.current = fieldKey;
  691:     requestAnimationFrame(() => {
  692:       const target = document.querySelector(`[data-field-key="${fieldKey}"]`) as HTMLElement | null;
  693:       target?.focus();
  694:     });
  695:   }, []);
  696: 
  697:   const sectionRequirements = useMemo(() => {
  698:     return getSectionRequirementSummary(state.profile, state.activeSection);
  699:   }, [state.activeSection, state.profile]);
  700: 
  701:   if (state.isLoading) {
  702:     return (
  703:       <div className="min-h-screen bg-background p-6">
  704:         <div className="mx-auto max-w-4xl space-y-4">
  705:           <Skeleton className="h-8 w-48" />
  706:           <Skeleton className="h-4 w-2/3" />
  707:           <Skeleton className="h-48 w-full" />
  708:           <Skeleton className="h-32 w-full" />
  709:         </div>
  710:       </div>
  711:     );
  712:   }
  713: 
  714:   const header = (
  715:     <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
  716:       <div>
  717:         <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Client onboarding</div>
  718:         <div className="text-lg font-semibold">{state.profile.q1_business_name || 'New client'}</div>
  719:       </div>
  720:       <div className="flex items-center gap-4">
  721:         <div className="text-xs text-muted-foreground">
  722:           {state.saveStatus === 'saving' && 'Saving.'}
  723:           {state.saveStatus === 'saved' && 'Saved'}
  724:           {state.saveStatus === 'error' && 'Error saving'}
  725:         </div>
  726:       </div>
  727:     </div>
  728:   );
  729: 
  730:   const nav = (
  731:     <SectionNav items={sectionItems} activeId={state.activeSection} onSelect={(id) => void handleSectionChange(id as V5SectionId)} />
  732:   );
  733: 
  734:   const preview = (
  735:     <RightRail
  736:       profile={state.profile}
  737:       meta={state.meta}
  738:       scan={state.scan.result}
  739:       collapsed={rightRailCollapsed}
  740:       onToggle={toggleRightRail}
  741:     />
  742:   );
  743: 
  744:   const mobileNav = (
  745:     <div className="mb-4 lg:hidden">
  746:       <SectionNav items={sectionItems} activeId={state.activeSection} onSelect={(id) => void handleSectionChange(id as V5SectionId)} />
  747:     </div>
  748:   );
  749: 
  750:   return (
  751:     <OnboardingV5Layout header={header} nav={nav} preview={preview}>
  752:       {mobileNav}
  753:       {state.activeSection === 'basics' && (
  754:         <BasicsSection
  755:           profile={state.profile}
  756:           scanResult={state.scan.result}
  757:           scanLoading={state.scan.loading}
  758:           onScan={runScan}
  759:           scanReviewOpen={scanReviewOpen}
  760:           onScanReviewOpenChange={setScanReviewOpen}
  761:           onFieldChange={updateField}
  762:           missingFields={sectionRequirements.missing}
  763:           onFocusField={focusField}
  764:           onNext={goToNextSection}
  765:         />
  766:       )}
  767:       {state.activeSection === 'goal' && (
  768:         <GoalSection
  769:           profile={state.profile}
  770:           onFieldChange={updateField}
  771:           missingFields={sectionRequirements.missing}
  772:           onFocusField={focusField}
  773:           onNext={goToNextSection}
  774:           onBack={goToPreviousSection}
  775:         />
  776:       )}
  777:       {state.activeSection === 'offers' && (
  778:         <OffersSection
  779:           profile={state.profile}
  780:           onFieldChange={updateField}
  781:           missingFields={sectionRequirements.missing}
  782:           onFocusField={focusField}
  783:           onNext={goToNextSection}
  784:           onBack={goToPreviousSection}
  785:         />
  786:       )}
  787:       {state.activeSection === 'audience' && (
  788:         <AudienceSection
  789:           profile={state.profile}
  790:           onFieldChange={updateField}
  791:           missingFields={sectionRequirements.missing}
  792:           onFocusField={focusField}
  793:           onNext={goToNextSection}
  794:           onBack={goToPreviousSection}
  795:         />
  796:       )}
  797:       {state.activeSection === 'brand' && (
  798:         <BrandSection
  799:           profile={state.profile}
  800:           onFieldChange={updateField}
  801:           missingFields={sectionRequirements.missing}
  802:           onFocusField={focusField}
  803:           onNext={goToNextSection}
  804:           onBack={goToPreviousSection}
  805:         />
  806:       )}
  807:       {state.activeSection === 'proof' && (
  808:         <ProofSection
  809:           profile={state.profile}
  810:           onFieldChange={updateField}
  811:           missingFields={sectionRequirements.missing}
  812:           onFocusField={focusField}
  813:           onNext={goToNextSection}
  814:           onBack={goToPreviousSection}
  815:         />
  816:       )}
  817:       {state.activeSection === 'channels' && (
  818:         <ChannelsSection
  819:           profile={state.profile}
  820:           onFieldChange={updateField}
  821:           missingFields={sectionRequirements.missing}
  822:           onFocusField={focusField}
  823:           onNext={goToNextSection}
  824:           onBack={goToPreviousSection}
  825:         />
  826:       )}
  827:       {state.activeSection === 'review' && (
  828:         <ReviewSection
  829:           profile={state.profile}
  830:           isGenerating={isGenerating}
  831:           onGenerate={generateStrategy}
  832:           onBack={goToPreviousSection}
  833:           onNavigate={(sectionId, fieldKey) => void handleSectionChange(sectionId as V5SectionId, fieldKey)}
  834:         />
  835:       )}
  836:       <AIScanReviewDialog
  837:         open={scanReviewOpen}
  838:         onOpenChange={setScanReviewOpen}
  839:         isLoading={state.scan.loading}
  840:         scanResult={state.scan.result}
  841:         onApplyAll={applyScanAll}
  842:         onApplyField={applyScanField}
  843:         fieldStatus={scanFieldStatus}
  844:       />
  845:     </OnboardingV5Layout>
  846:   );
  847: }
```

### Onboarding AI calls (`rg -n "ai-brains-client|ai-brain-ingest|ai-strategy-generate" ... -A 3`)

```text
src/components/onboarding-v5\OnboardingV5Wizard.tsx:597:      const { data: createResp, error: createErr } = await supabase.functions.invoke('ai-brains-client', {
src/components/onboarding-v5\OnboardingV5Wizard.tsx-598-        body: {
src/components/onboarding-v5\OnboardingV5Wizard.tsx-599-          action: 'create',
src/components/onboarding-v5\OnboardingV5Wizard.tsx-600-          agency_id: agencyId,
--
src/components/onboarding-v5\OnboardingV5Wizard.tsx:610:      const { error: updateErr } = await supabase.functions.invoke('ai-brains-client', {
src/components/onboarding-v5\OnboardingV5Wizard.tsx-611-        body: {
src/components/onboarding-v5\OnboardingV5Wizard.tsx-612-          action: 'update',
src/components/onboarding-v5\OnboardingV5Wizard.tsx-613-          agency_id: agencyId,
--
src/components/onboarding-v5\OnboardingV5Wizard.tsx:621:      const { error: ingestErr } = await supabase.functions.invoke('ai-brain-ingest', {
src/components/onboarding-v5\OnboardingV5Wizard.tsx-622-        body: {
src/components/onboarding-v5\OnboardingV5Wizard.tsx-623-          scope: 'client',
src/components/onboarding-v5\OnboardingV5Wizard.tsx-624-          agency_id: agencyId,
--
src/components/onboarding-v5\OnboardingV5Wizard.tsx:634:      const { data: strategyResp, error: strategyErr } = await supabase.functions.invoke('ai-strategy-generate', {
src/components/onboarding-v5\OnboardingV5Wizard.tsx-635-        body: { client_id: clientId },
src/components/onboarding-v5\OnboardingV5Wizard.tsx-636-      });
src/components/onboarding-v5\OnboardingV5Wizard.tsx-637-      if (strategyErr) throw strategyErr;
--
src/components/onboarding-v4\OnboardingContext.tsx:499:      const { data: createResp, error: createErr } = await supabase.functions.invoke('ai-brains-client', {
src/components/onboarding-v4\OnboardingContext.tsx-500-        body: {
src/components/onboarding-v4\OnboardingContext.tsx-501-          action: 'create',
src/components/onboarding-v4\OnboardingContext.tsx-502-          agency_id: agencyId,
--
src/components/onboarding-v4\OnboardingContext.tsx:517:      const { error: updateErr } = await supabase.functions.invoke('ai-brains-client', {
src/components/onboarding-v4\OnboardingContext.tsx-518-        body: {
src/components/onboarding-v4\OnboardingContext.tsx-519-          action: 'update',
src/components/onboarding-v4\OnboardingContext.tsx-520-          agency_id: agencyId,
--
src/components/onboarding-v4\OnboardingContext.tsx:531:      const { error: ingestErr } = await supabase.functions.invoke('ai-brain-ingest', {
src/components/onboarding-v4\OnboardingContext.tsx-532-        body: {
src/components/onboarding-v4\OnboardingContext.tsx-533-          scope: 'client',
src/components/onboarding-v4\OnboardingContext.tsx-534-          agency_id: agencyId,
```

### Completion handler search (`rg -n "onComplete|handleComplete|finish" ... -A 5`)

```text
```

## Verification SQL/Commands
```bash
# Locate onboarding completion logic and AI calls
rg -n "ai-brains-client|ai-brain-ingest|ai-strategy-generate" src/components/onboarding-v4 src/components/onboarding-v5 -S
```

```sql
-- After onboarding completes for a client:
SELECT usable, status, updated_at FROM client_brains WHERE client_id = :client_id ORDER BY version DESC LIMIT 1;

-- Confirm a strategy was generated and stored
SELECT id, client_id, is_active, updated_at FROM strategy_documents WHERE client_id = :client_id ORDER BY updated_at DESC LIMIT 5;
```

## Problems Found
1. Completion sequence is a multi-call pipeline; if any call fails silently, the UI can appear “complete” while the client remains unusable.
2. There is a dependency on environment secrets (`OPENAI_API_KEY`) for ingest/strategy; missing secrets must be surfaced as explicit errors.

## Recommendations
1. Treat onboarding completion as transactional from the user’s perspective: do not finalize UI completion until `ai-brain-ingest` succeeds and `client_brains.usable=true` is verified.
2. If auto strategy generation is part of completion, show progress and handle gated responses by directing users to fix missing profile fields.
3. Add monitoring around onboarding completion failures (rate, codes) and record them in `ai_runs`/`ai_usage_logs` consistently.
