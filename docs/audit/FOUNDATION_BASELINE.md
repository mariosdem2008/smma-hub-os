# Foundation Baseline

## Test Run

Command:
`npm run test`

Output (normalized to ASCII; ANSI color codes removed):
```> vite_react_shadcn_ts@0.0.0 test
> vitest run

RUN v2.1.9 C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os

PASS src/data/__tests__/adminChatStrategicPlaybooks.test.ts (4 tests) 6ms
PASS src/lib/onboarding/__tests__/readiness.test.ts (29 tests) 14ms
PASS src/ai/providers/__tests__/utils.test.ts (4 tests) 14ms
PASS src/ai/__tests__/modelPolicy.test.ts (6 tests) 16ms
PASS src/lib/onboarding/__tests__/strategy-mapping.test.ts (46 tests) 121ms
PASS supabase/functions/_shared/__tests__/tool-executor.test.ts (60 tests) 119ms
stderr | src/components/onboarding-v4/__tests__/OnboardingContext.test.tsx > OnboardingContext > error handling > throws error when useOnboarding used outside provider
Error: Uncaught [Error: useOnboarding must be used within an OnboardingProvider]
    at reportException (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\helpers\runtime-script-errors.js:66:24)
    at innerInvokeEventListeners (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:353:9)
    at invokeEventListeners (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
    at HTMLUnknownElementImpl._dispatch (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:233:9)
    at HTMLUnknownElementImpl.dispatchEvent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:104:17)
    at HTMLUnknownElement.dispatchEvent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\generated\EventTarget.js:241:34)
    at Object.invokeGuardedCallbackDev (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:4213:16)
    at invokeGuardedCallback (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:4277:31)
    at beginWork$1 (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:27490:7)
    at performUnitOfWork (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:26599:12) Error: useOnboarding must be used within an OnboardingProvider
    at Module.useOnboarding (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\src\components\onboarding-v4\OnboardingContext.tsx:586:11)
    at C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\src\components\onboarding-v4\__tests__\OnboardingContext.test.tsx:509:41
    at TestComponent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\@testing-library\react\dist\pure.js:330:27)
    at renderWithHooks (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:15486:18)
    at mountIndeterminateComponent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:20103:13)
    at beginWork (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:21626:16)
    at HTMLUnknownElement.callCallback (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:4164:14)
    at HTMLUnknownElement.callTheUserObjectsOperation (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
    at innerInvokeEventListeners (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:350:25)
    at invokeEventListeners (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
Error: Uncaught [Error: useOnboarding must be used within an OnboardingProvider]
    at reportException (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\helpers\runtime-script-errors.js:66:24)
    at innerInvokeEventListeners (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:353:9)
    at invokeEventListeners (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
    at HTMLUnknownElementImpl._dispatch (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:233:9)
    at HTMLUnknownElementImpl.dispatchEvent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:104:17)
    at HTMLUnknownElement.dispatchEvent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\generated\EventTarget.js:241:34)
    at Object.invokeGuardedCallbackDev (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:4213:16)
    at invokeGuardedCallback (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:4277:31)
    at beginWork$1 (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:27490:7)
    at performUnitOfWork (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:26599:12) Error: useOnboarding must be used within an OnboardingProvider
    at Module.useOnboarding (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\src\components\onboarding-v4\OnboardingContext.tsx:586:11)
    at C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\src\components\onboarding-v4\__tests__\OnboardingContext.test.tsx:509:41
    at TestComponent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\@testing-library\react\dist\pure.js:328:5)
    at renderWithHooks (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:15486:18)
    at mountIndeterminateComponent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:20103:13)
    at beginWork (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:21626:16)
    at HTMLUnknownElement.callCallback (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\react-dom\cjs\react-dom.development.js:4164:14)
    at HTMLUnknownElement.callTheUserObjectsOperation (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\generated\EventListener.js:26:30)
    at innerInvokeEventListeners (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:350:25)
    at invokeEventListeners (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\jsdom\lib\jsdom\living\events\EventTarget-impl.js:286:3)
The above error occurred in the <TestComponent> component:

    at TestComponent (C:\Users\mario\Desktop\SMMAHUB\smmahub\2\smma-hub-os\node_modules\@testing-library\react\dist\pure.js:328:5)

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://reactjs.org/link/error-boundaries to learn more about error boundaries.

PASS src/components/onboarding-v4/__tests__/OnboardingContext.test.tsx (27 tests) 249ms
PASS src/ai/__tests__/router.test.ts (5 tests) 11ms
stdout | src/data/__tests__/agencyAdminChatSchema.test.ts > agency admin chat schema mode > returns parsed JSON output with suggestions array
admin_chat_tool_results {
  agency_id: 'agency-1',
  user_id: 'user-1',
  results: [ { type: 'notify', success: false, error: 'Unknown tool: notify' } ]
}
stderr | src/data/__tests__/agencyAdminChatSchema.test.ts > agency admin chat schema mode > returns parsed JSON output with suggestions array
admin_chat_tool_failed { tool: 'notify', error: 'Unknown tool: notify' }

PASS src/data/__tests__/agencyAdminChatSchema.test.ts (3 tests) 16ms

PASS src/data/__tests__/agencyAdminChatHandler.test.ts (6 tests) 42ms
stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > ready confirmation starts question 1
{"event":"setup_transition","thread_id":"thread-1","from":"readiness_confirmation","to":"agency.primary_services"}
stderr | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > flag ON falls back when orchestrator returns invalid JSON
guided_setup_orchestrator_invalid_output { thread_id: 'thread-1', agency_id: 'agency-1' }

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > answer advances to next question with progress
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.primary_services"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.primary_services","to":"agency.niche_industries"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.primary_services"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > flag OFF uses hardcoded next question without orchestrator
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.primary_services"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.primary_services","to":"agency.niche_industries"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.primary_services"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > flag ON uses orchestrator result exactly once
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.primary_services"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.primary_services","to":"agency.target_client_profile"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.primary_services"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > flag ON falls back when orchestrator returns invalid JSON
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.primary_services"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.primary_services","to":"agency.niche_industries"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.primary_services"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > flag ON falls back when orchestrator id is not in registry
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.primary_services"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.primary_services","to":"agency.niche_industries"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.primary_services"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > flag ON falls back when orchestrator throws
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.primary_services"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.primary_services","to":"agency.niche_industries"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.primary_services"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > prefills context snapshot with agency name and website for extraction
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.target_client_profile"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.target_client_profile","to":"agency.primary_services"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.target_client_profile"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > handles missing agency name and website in context snapshot
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.target_client_profile"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.target_client_profile","to":"agency.primary_services"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.target_client_profile"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > handles agency fetch failure without leaking secrets
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.target_client_profile"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.target_client_profile","to":"agency.primary_services"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.target_client_profile"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > invalid JSON extraction triggers deterministic parse failure
{"event":"setup_parse_failure","thread_id":"thread-1","question_key":"agency.target_client_profile","reason":"extract_error","error":"invalid json"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > detects done state when all questions answered
{"event":"setup_answer","thread_id":"thread-1","question_key":"faq.seed_top10"}
{"event":"setup_transition","thread_id":"thread-1","from":"faq.seed_top10","to":null}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"faq.seed_top10"}
{"event":"calibration_complete","thread_id":"thread-1","agency_id":"agency-1"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > calculates progress percentage correctly
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.primary_services"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.primary_services","to":"agency.target_client_profile"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.primary_services"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > orchestrator handles question not in registry gracefully
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.primary_services"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.primary_services","to":"agency.niche_industries"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.primary_services"}

stdout | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > preserves conversation history across turns
{"event":"setup_answer","thread_id":"thread-1","question_key":"agency.target_client_profile"}
{"event":"setup_transition","thread_id":"thread-1","from":"agency.target_client_profile","to":"agency.primary_services"}
{"event":"calibration_answer_recorded","thread_id":"thread-1","question_key":"agency.target_client_profile"}

PASS src/data/__tests__/agencyAdminSetupGuided.test.ts (21 tests) 104ms

stderr | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > flag ON falls back when orchestrator id is not in registry
guided_setup_orchestrator_invalid_output { thread_id: 'thread-1', agency_id: 'agency-1' }

stderr | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > flag ON falls back when orchestrator throws
guided_setup_orchestrator_failed {
  thread_id: 'thread-1',
  agency_id: 'agency-1',
  message: 'orchestrator failure'
}

stderr | src/data/__tests__/agencyAdminSetupGuided.test.ts > agency admin setup guided > orchestrator handles question not in registry gracefully
guided_setup_orchestrator_invalid_output { thread_id: 'thread-1', agency_id: 'agency-1' }

stderr | src/pages/__tests__/invitations.test.tsx > /invitations > renders pending invites from RPC
WARN React Router Future Flag Warning: React Router will begin wrapping state updates in React.startTransition in v7. You can use the v7_startTransition future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
WARN React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the v7_relativeSplatPath future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

stderr | src/pages/__tests__/PortalAiAssistantAndAdminGuard.test.tsx > Client portal AI + admin guard > renders Client Portal AI Assistant page using clientId from outlet context
WARN React Router Future Flag Warning: React Router will begin wrapping state updates in React.startTransition in v7. You can use the v7_startTransition future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
WARN React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the v7_relativeSplatPath future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

PASS src/pages/__tests__/PortalAiAssistantAndAdminGuard.test.tsx (3 tests) 325ms
stderr | src/pages/ai/__tests__/AgencyAiAdmin.test.tsx > AgencyAiAdmin > creates a general thread when clicking New chat
WARN React Router Future Flag Warning: React Router will begin wrapping state updates in React.startTransition in v7. You can use the v7_startTransition future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
WARN React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the v7_relativeSplatPath future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

PASS src/pages/__tests__/invitations.test.tsx (4 tests) 1181ms
  PASS /invitations > renders pending invites from RPC 422ms
stderr | src/pages/__tests__/create-agency-flow.test.tsx > create agency onboarding flow > welcome -> create-agency -> dashboard
WARN React Router Future Flag Warning: React Router will begin wrapping state updates in React.startTransition in v7. You can use the v7_startTransition future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
WARN React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the v7_relativeSplatPath future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

PASS src/pages/ai/__tests__/AgencyAiAdmin.test.tsx (3 tests) 1945ms
  PASS AgencyAiAdmin > creates a general thread when clicking New chat 962ms
  PASS AgencyAiAdmin > creates a single setup thread from Start Setup 317ms
  PASS AgencyAiAdmin > sends suggestion user_message when clicked 660ms
PASS src/data/__tests__/agencyAdminSetupQuestions.test.ts (5 tests) 8ms
PASS src/ai/__tests__/adminSetupGuidedPrompt.test.ts (4 tests) 18ms
PASS tests/integration/ai/budget-enforcement.test.ts (3 tests) 8ms
PASS tests/integration/ai/rag-correctness.test.ts (3 tests) 16ms
PASS src/ai/__tests__/toolSchemas.test.ts (4 tests) 34ms
stderr | src/components/onboarding-v5/__tests__/onboardingV5Wizard.test.tsx > OnboardingV5Wizard > renders sections, autosaves, and applies scan without overwrite
WARN React Router Future Flag Warning: React Router will begin wrapping state updates in React.startTransition in v7. You can use the v7_startTransition future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
WARN React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the v7_relativeSplatPath future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

PASS src/data/__tests__/clientBrainMapping.test.ts (2 tests) 9ms
stderr | src/pages/__tests__/ClientDetailGate.test.tsx > ClientDetail gate > blocks access when client is unusable
WARN React Router Future Flag Warning: React Router will begin wrapping state updates in React.startTransition in v7. You can use the v7_startTransition future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
WARN React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the v7_relativeSplatPath future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

PASS src/pages/__tests__/bootstrap-routing.test.tsx (2 tests) 203ms
PASS src/data/__tests__/adminChatStrategicValidator.test.ts (3 tests) 4ms
PASS src/ai/budgets.test.ts (6 tests) 19ms
PASS src/pages/__tests__/create-agency-flow.test.tsx (1 test) 3723ms
  PASS create agency onboarding flow > welcome -> create-agency -> dashboard 3708ms
PASS src/data/__tests__/clientBrainStatus.test.ts (3 tests) 4ms
stderr | src/components/brain/__tests__/BrainLayerDetail.test.tsx > BrainLayerDetail > routing > renders the correct layer page for rep_policy
WARN React Router Future Flag Warning: React Router will begin wrapping state updates in React.startTransition in v7. You can use the v7_startTransition future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
WARN React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the v7_relativeSplatPath future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

PASS src/components/onboarding-v5/lib/__tests__/progress.test.ts (2 tests) 15ms
PASS src/components/client-tabs/__tests__/ClientTabEmptyState.test.tsx (5 tests) 472ms
PASS src/lib/__tests__/bootstrap-decision.test.ts (4 tests) 15ms
PASS src/components/client-tabs/__tests__/StrategyHubTab.strategyOSV3.test.tsx (7 tests) 3217ms
  PASS StrategyHubTab Strategy Knowledge Center > defaults to the document view 441ms
  PASS StrategyHubTab Strategy Knowledge Center > opens details view and returns to document view 424ms
  PASS StrategyHubTab Strategy Knowledge Center > activates history entries 496ms
  PASS StrategyHubTab Strategy Knowledge Center > regenerates strategy document with instruction 1666ms
PASS src/ai/ragPolicy.test.ts (3 tests) 4ms
PASS src/data/__tests__/agencyAdminSetupExpertRegistry.test.ts (4 tests) 19ms
PASS src/data/__tests__/unusedEndpointLockdown.test.ts (3 tests) 14ms
PASS src/data/__tests__/aiRepIntegration.test.ts (1 test) 9ms
PASS src/data/__tests__/aiRepChat.test.ts (2 tests) 19ms
PASS tests/integration/ai/embedding-fail-hard.test.ts (3 tests) 12ms
PASS src/data/__tests__/agencyAdminSetupOrchestrator.test.ts (1 test) 3ms
PASS src/components/onboarding-v5/__tests__/onboardingV5Wizard.test.tsx (4 tests) 5904ms
  PASS OnboardingV5Wizard > renders sections, autosaves, and applies scan without overwrite 4546ms
  PASS OnboardingV5Wizard > defaults right rail to collapsed and persists expand state 581ms
  PASS OnboardingV5Wizard > gating helper focuses missing field 566ms
PASS src/components/brain/__tests__/BrainLayerDetail.test.tsx (22 tests) 3774ms
  PASS BrainLayerDetail > routing > renders the correct layer page for rep_policy 762ms
  PASS layer URL mapping > maps offer_stack URL param to Offer Stack module 319ms
PASS src/data/__tests__/adminChatStrategicRouter.test.ts (4 tests) 4ms
stderr | src/components/__tests__/PostCreateAgencyCta.test.tsx > PostCreateAgencyCta > shows CTA for admin when setup incomplete and routes to guided onboarding
WARN React Router Future Flag Warning: React Router will begin wrapping state updates in React.startTransition in v7. You can use the v7_startTransition future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
WARN React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the v7_relativeSplatPath future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.

PASS src/components/onboarding-v5/lib/__tests__/previewMapper.test.ts (2 tests) 13ms
PASS src/components/__tests__/PostCreateAgencyCta.test.tsx (2 tests) 763ms
  PASS PostCreateAgencyCta > shows CTA for admin when setup incomplete and routes to guided onboarding 735ms
PASS src/lib/__tests__/featureFlags.test.ts (4 tests) 40ms
PASS src/ai/__tests__/adminGeneralChatPrompt.test.ts (1 test) 9ms
PASS src/components/onboarding-v5/lib/__tests__/sanitize.test.ts (5 tests) 8ms
PASS tests/integration/ai/circuit-breaker.test.ts (1 test) 3ms
PASS src/components/strategy-os/modules/positioning/__tests__/PositioningModule.saveStatus.test.ts (4 tests) 3ms
PASS src/lib/__tests__/displayName.test.ts (3 tests) 3ms
PASS src/lib/__tests__/createAgencyRpc.test.ts (1 test) 7ms
PASS src/ai/__tests__/taskRegistry.test.ts (1 test) 2ms
PASS src/data/__tests__/agencyAdminChatActions.test.ts (1 test) 2ms
PASS src/data/__tests__/missingFieldMeta.test.ts (2 tests) 5ms
PASS src/ai/__tests__/adminChatStrategicSchema.test.ts (1 test) 2ms
PASS src/components/onboarding-v5/__tests__/audienceSection.test.tsx (1 test) 163ms
PASS src/ai/__tests__/promptRegistry.test.ts (1 test) 3ms
PASS src/components/client-tabs/__tests__/PipelineTab.stages.test.ts (1 test) 2ms

Test Files 56 passed (56)
Tests 356 passed (356)
Start at 12:46:09
Duration 19.41s (transform 7.96s, setup 26.12s, collect 48.48s, tests 23.04s, environment 162.92s, prepare 23.45s)
```

## Edge Functions Calling Provider APIs Directly (Bypass Router)

- Anthropic direct call in `supabase/functions/ai-onboarding-suggest/index.ts:106`.
- Anthropic direct call in `supabase/functions/ai-onboarding-scan/index.ts:267`.

## Embedding Write Paths + Zero-Vector Risk

Write paths into `ai_embeddings`:
- `supabase/functions/ai-documents-ingest/index.ts:228` inserts embeddings for document chunks.
- `supabase/functions/ai-brain-ingest/index.ts:272` inserts embeddings for agency brain summary chunks.
- `supabase/functions/ai-brain-ingest/index.ts:378` inserts embeddings for client brain summary chunks.

Zero-vector possibility:
- `supabase/functions/_shared/embedding-policy.ts:23` returns `zeroVector` when `apiKey` is missing and `failHard` is false.
- `supabase/functions/ai-documents-ingest/index.ts:103` and `supabase/functions/ai-brain-ingest/index.ts:109` set `failHard` via `AI_EMBEDDING_FAIL_HARD`.
- `supabase/functions/ai-documents-ingest/index.ts:189` and `supabase/functions/ai-brain-ingest/index.ts:235`/`341` build `zeroVector` with `DEFAULT_EMBEDDING_DIM`.
Conclusion: embeddings can be zero-vector when `OPENAI_API_KEY` is missing and `AI_EMBEDDING_FAIL_HARD` is not `true`.

## Doc Stores Used in Strategy Generation

Strategy generation (edge function):
- `client_brains` source of client brain JSON: `supabase/functions/ai-strategy-generate/index.ts:131`.
- `agency_brains` source of agency brain JSON: `supabase/functions/ai-strategy-generate/index.ts:161`.
- `client_onboarding_profiles` used as onboarding profile context: `supabase/functions/ai-strategy-generate/index.ts:169`.
- `strategies` and `strategy_modules` used as structured strategy context: `supabase/functions/ai-strategy-generate/index.ts:177` and `supabase/functions/ai-strategy-generate/index.ts:186`.
- Retrieval uses `match_ai_embeddings` and doc types that live in `ai_documents`: `supabase/functions/ai-strategy-generate/index.ts:230`.

Not used:
- No `brain_documents` access in `ai-strategy-generate` (no reads in this function).

## ai_embeddings Vector Dimension (DB + Code Assumptions)

DB dimension:
- `ai_embeddings.embedding` column uses `vector(1536)` in `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`.
- `match_ai_embeddings` functions accept `vector(1536)` in `supabase/migrations/20251224090000_brain_spine_v1.sql:66` and `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:28`.

Code assumptions:
- `DEFAULT_EMBEDDING_DIM = 1536` in `supabase/functions/_shared/embeddings.ts:7` (used for zero vectors and metadata in ingest functions).

## Strategy OS Module Seeding + Strategy Document Generation Paths

Strategy OS module seeding (templates):
- `useGenerateStrategy` seeds modules with template drafts via `getTemplateDraftContent` in `src/hooks/useStrategyModules.ts:236` and `src/hooks/useStrategyModules.ts:253`.
- Template content definitions and `getTemplateDraftContent` live in `src/lib/strategy/defaults.ts:229` and `src/lib/strategy/defaults.ts:522`.

Strategy document generation:
- UI triggers generation via edge function call `supabase.functions.invoke("ai-strategy-generate")` in `src/hooks/useStrategyDocuments.ts:67`.
- Edge function writes `strategy_documents` in `supabase/functions/ai-strategy-generate/index.ts:372` and `supabase/functions/ai-strategy-generate/index.ts:377`.

## Strategy Tab Gating Source of Truth

Gating is based on client brain status, not onboarding completion state:
- ClientDetail gate calls `getClientBrainStatus` in `src/pages/ClientDetail.tsx:173`.
- `getClientBrainStatus` uses RPC `get_client_brain_status` in `src/data/index.ts:316`.
- RPC reads from `public.client_brains` in `supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:48`.

## Tables Involved in AI + Strategy (Name + Purpose)

AI tables:
- `agency_brains`: agency-level brain JSON and status (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`).
- `client_brains`: client-level brain JSON and status (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:20`).
- `ai_documents`: source documents for AI retrieval (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:34`).
- `ai_document_chunks`: chunked document text for embeddings (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:61`).
- `ai_embeddings`: vector store for retrieval (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:71`).
- `ai_memory_items`: structured memory items (`supabase/migrations/20251224090000_brain_spine_v1.sql:6`).
- `ai_runs`: AI run logging with citations and costs (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:97`).
- `ai_usage_logs`: endpoint usage and cost tracking (`supabase/migrations/20251224090000_brain_spine_v1.sql:16`).
- `ai_prompt_registry`: prompt catalog (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:84`).
- `ai_budgets`: per-tenant budget caps (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:117`).
- `ai_rate_limits`: rate limit tracking (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:131`).
- `ai_escalations`: AI escalation tracking (`supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:144`).
- `client_onboarding_profiles`: onboarding profile data used in strategy generation context (`supabase/migrations/20251230200000_client_onboarding_v4.sql:16`).

Strategy tables:
- `strategies`: versioned strategy records (`supabase/migrations/20251230090000_strategy_os_ops.sql:4`).
- `strategy_modules`: per-module strategy content (`supabase/migrations/20251229100000_strategy_os.sql:33`).
- `strategy_history`: module change history (`supabase/migrations/20251229100000_strategy_os.sql:56`).
- `strategy_tasks`: tasks linked to strategy modules (`supabase/migrations/20251229100000_strategy_os.sql:68`).
- `strategy_decisions`: decision locks/values (`supabase/migrations/20251230090000_strategy_os_ops.sql:22`).
- `strategy_documents`: full strategy document snapshots (`supabase/migrations/20260106120000_strategy_documents.sql:3`).

## Strategy READ Locations (Code)

Edge functions:
- `supabase/functions/ai-strategy-generate/index.ts:131` reads `client_brains`.
- `supabase/functions/ai-strategy-generate/index.ts:161` reads `agency_brains`.
- `supabase/functions/ai-strategy-generate/index.ts:169` reads `client_onboarding_profiles`.
- `supabase/functions/ai-strategy-generate/index.ts:177` reads `strategies`.
- `supabase/functions/ai-strategy-generate/index.ts:186` reads `strategy_modules`.
- `supabase/functions/ai-strategy-generate/index.ts:234` reads embeddings via `match_ai_embeddings`.

Frontend hooks:
- `src/hooks/useStrategies.ts:15` reads `strategies`.
- `src/hooks/useStrategyModules.ts:31` reads `strategy_modules`.
- `src/hooks/useStrategyDocuments.ts:16` reads `strategy_documents`.
- `src/hooks/useStrategyDecisions.ts:20` reads `strategy_decisions`.
- `src/hooks/useStrategyTasks.ts:37` reads `strategy_tasks`.
- `src/hooks/useStrategyHistory.ts:33` reads `strategy_history`.

## Commands Used For This Baseline

- `npm run test`
- `rg -n "api\\.anthropic\\.com" supabase/functions/ai-onboarding-suggest/index.ts supabase/functions/ai-onboarding-scan/index.ts`
- `rg -n "ai_embeddings" supabase/functions`
- `rg -n "AI_EMBEDDING_FAIL_HARD|embedWithPolicy|zeroVector" supabase/functions/ai-documents-ingest/index.ts supabase/functions/ai-brain-ingest/index.ts supabase/functions/_shared/embedding-policy.ts`
- `rg -n "client_brains|agency_brains|client_onboarding_profiles|strategies|strategy_modules|match_ai_embeddings" supabase/functions/ai-strategy-generate/index.ts`
- `rg -n "legacyClientDocTypes|legacyAgencyDocTypes|legacyExemplarDocTypes|doc_types" supabase/functions/ai-strategy-generate/index.ts`
- `rg -n "vector\\(1536\\)" supabase/migrations`
- `rg -n "DEFAULT_EMBEDDING_DIM" supabase/functions/_shared/embeddings.ts`
- `rg -n "useGenerateStrategy|getTemplateDraftContent" src/hooks/useStrategyModules.ts`
- `rg -n "TEMPLATE_|getTemplateDraftContent" src/lib/strategy/defaults.ts`
- `rg -n "ai-strategy-generate|strategy_documents" src/hooks/useStrategyDocuments.ts supabase/functions/ai-strategy-generate/index.ts`
- `rg -n "getClientBrainStatus" src/pages/ClientDetail.tsx src/data/index.ts`
- `rg -n "client_brains" supabase/migrations/20251224121500_get_client_brain_status_rpc.sql`
- `rg -n "CREATE TABLE IF NOT EXISTS public.strategy_documents|strategy_modules|strategy_history|strategy_tasks|strategies|strategy_decisions" supabase/migrations/20260106120000_strategy_documents.sql supabase/migrations/20251229100000_strategy_os.sql supabase/migrations/20251230090000_strategy_os_ops.sql`
