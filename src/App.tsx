import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";

import { AuthProvider } from "@/lib/auth";
import { ClientAuthProvider } from "@/lib/client-auth";

import { UpgradeModalProvider } from "@/contexts/UpgradeModalContext";
import { GlobalUpgradeModal } from "@/components/GlobalUpgradeModal";
import { UpgradeAssistantProvider } from "@/contexts/UpgradeAssistantContext";
import { UpgradeAssistantCard } from "@/components/UpgradeAssistantCard";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { ClientDetailLayout } from "@/components/ClientDetailLayout";
import { useTimezoneDetection } from "@/hooks/useTimezoneDetection";
import { isValidBrainModule } from "@/lib/ai/brainModules";

const Landing = lazy(() => import("./pages/LandingV2"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AiOnboardingAgency = lazy(() => import("./pages/ai/AiOnboardingAgency"));
const Bootstrap = lazy(() => import("./pages/Bootstrap"));
const Welcome = lazy(() => import("./pages/Welcome"));
const AgencyWelcomeAI = lazy(() => import("./pages/AgencyWelcomeAI"));
const SelectAgency = lazy(() => import("./pages/SelectAgency"));
const CreateAgencyStub = lazy(() => import("./pages/CreateAgencyStub"));
const Invitations = lazy(() => import("./pages/Invitations"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Team = lazy(() => import("./pages/Team"));
const Settings = lazy(() => import("./pages/Settings"));
const Billing = lazy(() => import("./pages/Billing"));
const BillingOverview = lazy(() => import("./pages/BillingOverview"));
const Messages = lazy(() => import("./pages/Messages"));
const AiOnboardingClient = lazy(() => import("./pages/ai/AiOnboardingClient"));
const AgencyAiAdmin = lazy(() => import("./pages/ai/AgencyAiAdmin"));
const AISetup = lazy(() => import("./pages/agency/AISetup"));
const ModuleDetail = lazy(() => import("./pages/agency/ModuleDetail"));
const AgencyAiSetupV2Layout = lazy(() => import("./pages/agency/AgencyAiSetupV2Layout"));
const AgencyAiSetupV2Overview = lazy(() => import("./pages/agency/AgencyAiSetupV2Overview"));
const AgencyAiSetupV2Section = lazy(() => import("./pages/agency/AgencyAiSetupV2Section"));
const AgencyAiSetupV2Imports = lazy(() => import("./pages/agency/AgencyAiSetupV2Imports"));
const AgencyAiSetupV2Foundations = lazy(() => import("./pages/agency/AgencyAiSetupV2Foundations"));
const AgencyAiSetupV2Modules = lazy(() => import("./pages/agency/AgencyAiSetupV2Modules"));
const AgencyAiSetupV2ModuleDetail = lazy(() => import("./pages/agency/AgencyAiSetupV2ModuleDetail"));
const AgencyAiSetupV2Guardrails = lazy(() => import("./pages/agency/AgencyAiSetupV2Guardrails"));
const AgencyAiSetupV2Workflow = lazy(() => import("./pages/agency/AgencyAiSetupV2Workflow"));
const AgencyAiSetupV2Readiness = lazy(() => import("./pages/agency/AgencyAiSetupV2Readiness"));
const AgencyAiSetupV2ReadinessPreview = lazy(() => import("./pages/agency/AgencyAiSetupV2ReadinessPreview"));
const AgencyAiSetupV2Activation = lazy(() => import("./pages/agency/AgencyAiSetupV2Activation"));
const AgencyAiSetupV2Activate = lazy(() => import("./pages/agency/AgencyAiSetupV2Activate"));
const AgencyAiSetupV2ControlCenter = lazy(() => import("./pages/agency/AgencyAiSetupV2ControlCenter"));

const ClientPortalLayout = lazy(() =>
  import("./pages/ClientPortalLayout").then((module) => ({ default: module.ClientPortalLayout })),
);
const ClientLogin = lazy(() => import("./pages/client/ClientLogin"));
const ClientAcceptInvite = lazy(() => import("./pages/client/ClientAcceptInvite"));
const ClientForgotPassword = lazy(() => import("./pages/client/ClientForgotPassword"));
const ClientResetPassword = lazy(() => import("./pages/client/ClientResetPassword"));

const PortalOverview = lazy(() =>
  import("./pages/client-portal/PortalOverview").then((module) => ({ default: module.PortalOverview })),
);
const PortalBranding = lazy(() =>
  import("./pages/client-portal/PortalBranding").then((module) => ({ default: module.PortalBranding })),
);
const PortalSocial = lazy(() =>
  import("./pages/client-portal/PortalSocial").then((module) => ({ default: module.PortalSocial })),
);
const PortalSocialProfiles = lazy(() => import("./pages/client-portal/PortalSocialProfiles"));
const PortalIdeas = lazy(() =>
  import("./pages/client-portal/PortalIdeas").then((module) => ({ default: module.PortalIdeas })),
);
const PortalAssets = lazy(() =>
  import("./pages/client-portal/PortalAssets").then((module) => ({ default: module.PortalAssets })),
);
const PortalContentCalendar = lazy(() =>
  import("./pages/client-portal/PortalContentCalendar").then((module) => ({ default: module.PortalContentCalendar })),
);
const PortalUploads = lazy(() => import("./pages/client-portal/PortalUploads"));
const PortalApprovals = lazy(() => import("./pages/client-portal/PortalApprovals"));
const PortalMessages = lazy(() => import("./pages/client-portal/PortalMessages"));
const PortalPerformance = lazy(() =>
  import("./pages/client-portal/PortalPerformance").then((module) => ({ default: module.PortalPerformance })),
);
const ReportDetail = lazy(() => import("./components/client-tabs/ReportDetail"));
const PortalAiAssistant = lazy(() =>
  import("./pages/client-portal/PortalAiAssistant").then((module) => ({ default: module.PortalAiAssistant })),
);

function LegacyBrainLayerRedirect() {
  const { layer } = useParams<{ layer?: string }>();

  const layerMap: Record<string, string> = {
    bootstrap_profile: "bootstrap",
    rep_policy: "rep_policy",
    strategy_sop: "sop_strategy",
    scripting_sop: "sop_scripting",
    tone_voice: "tone_voice",
    faq_objections: "faq_objections",
    ai_permissions: "ai_permissions",
    offer_stack: "offer_stack",
    quality_bar: "quality_bar",
  };

  const next = layer ? (layerMap[layer] ?? layer) : null;
  if (next && isValidBrainModule(next)) {
    return <Navigate to={`/agency/ai-setup/${next}`} replace />;
  }
  return <Navigate to="/agency/ai-setup" replace />;
}

const queryClient = new QueryClient();

function ProtectedAppShell() {
  return (
    <ProtectedRoute>
      <UpgradeModalProvider>
        <UpgradeAssistantProvider>
          <GlobalUpgradeModal />
          <UpgradeAssistantCard />
          <AppLayout />
        </UpgradeAssistantProvider>
      </UpgradeModalProvider>
    </ProtectedRoute>
  );
}

function ProtectedClientDetailShell() {
  return (
    <ProtectedRoute>
      <ClientDetailLayout />
    </ProtectedRoute>
  );
}

function ClientAuthShell() {
  return (
    <ClientAuthProvider>
      <Outlet />
    </ClientAuthProvider>
  );
}

const App = () => {
  useTimezoneDetection();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* ✅ ONLY auth provider is global */}
          <AuthProvider>
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                  Loading...
                </div>
              }
            >
              <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/invite/:token" element={<InviteAccept />} />

              {/* Client portal routes (shared client auth provider scope) */}
              <Route path="/client" element={<ClientAuthShell />}>
                <Route path="login" element={<ClientLogin />} />
                <Route path="login/:portalSlug" element={<ClientLogin />} />
                <Route path="accept-invite" element={<ClientAcceptInvite />} />
                <Route path="forgot-password/:portalSlug" element={<ClientForgotPassword />} />
                <Route path="reset-password" element={<ClientResetPassword />} />

                <Route path="portal" element={<ClientPortalLayout />}>
                  <Route index element={<PortalOverview />} />
                  <Route path="approvals" element={<PortalApprovals />} />
                  <Route path="content-calendar" element={<PortalContentCalendar />} />
                  <Route path="performance" element={<PortalPerformance />} />
                  <Route path="ideas" element={<PortalIdeas />} />
                  <Route path="assets" element={<PortalAssets />} />
                  <Route path="branding" element={<PortalBranding />} />
                  <Route path="social" element={<PortalSocial />} />
                  <Route path="social-profiles" element={<PortalSocialProfiles />} />
                  <Route path="uploads" element={<PortalUploads />} />
                  <Route path="messages" element={<PortalMessages />} />
                  <Route path="ai-assistant" element={<PortalAiAssistant />} />
                </Route>
                <Route path="portal/:portalSlug" element={<ClientPortalLayout />}>
                  <Route index element={<PortalOverview />} />
                  <Route path="approvals" element={<PortalApprovals />} />
                  <Route path="content-calendar" element={<PortalContentCalendar />} />
                  <Route path="performance" element={<PortalPerformance />} />
                  <Route path="ideas" element={<PortalIdeas />} />
                  <Route path="assets" element={<PortalAssets />} />
                  <Route path="branding" element={<PortalBranding />} />
                  <Route path="social" element={<PortalSocial />} />
                  <Route path="social-profiles" element={<PortalSocialProfiles />} />
                  <Route path="uploads" element={<PortalUploads />} />
                  <Route path="messages" element={<PortalMessages />} />
                  <Route path="ai-assistant" element={<PortalAiAssistant />} />
                </Route>
              </Route>

              {/* Onboarding */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Navigate to="/welcome" replace />
                  </ProtectedRoute>
                }
              />

              {/* Bootstrap / tenancy selection */}
              <Route
                path="/bootstrap"
                element={
                  <ProtectedRoute>
                    <Bootstrap />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/welcome"
                element={
                  <ProtectedRoute>
                    <Welcome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/select-agency"
                element={
                  <ProtectedRoute>
                    <SelectAgency />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create-agency"
                element={
                  <ProtectedRoute>
                    <CreateAgencyStub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invitations"
                element={
                  <ProtectedRoute>
                    <Invitations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agency/welcome-ai"
                element={
                  <ProtectedRoute>
                    <AgencyWelcomeAI />
                  </ProtectedRoute>
                }
              />

              {/* Protected App Routes */}
              <Route element={<ProtectedAppShell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/team" element={<Team />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/billing/overview" element={<BillingOverview />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/agency/ai-setup" element={<AgencyAiSetupV2Layout />}>
                  <Route index element={<AgencyAiSetupV2Overview />} />
                  <Route path="start" element={<Navigate to="/agency/ai-setup/imports" replace />} />
                  <Route path="imports" element={<AgencyAiSetupV2Imports />} />
                  <Route path="foundations" element={<AgencyAiSetupV2Foundations />} />
                  <Route path="modules" element={<AgencyAiSetupV2Modules />} />
                  <Route path="modules/:moduleKey" element={<AgencyAiSetupV2ModuleDetail />} />
                  <Route path="guardrails" element={<AgencyAiSetupV2Guardrails />} />
                  <Route path="workflow" element={<AgencyAiSetupV2Workflow />} />
                  <Route path="activate" element={<AgencyAiSetupV2Activate />} />
                  <Route path="readiness" element={<AgencyAiSetupV2Readiness />} />
                  <Route path="readiness/preview/:agentClass" element={<AgencyAiSetupV2ReadinessPreview />} />
                  <Route path="activation" element={<AgencyAiSetupV2Activation />} />
                  <Route path="control-center" element={<AgencyAiSetupV2ControlCenter />} />
                  <Route path="legacy" element={<AISetup />} />
                </Route>
                <Route path="/agency/ai-setup/:moduleKey" element={<ModuleDetail />} />

                {/* Legacy Agency Brain redirects */}
                <Route path="/agency/brain" element={<Navigate to="/agency/ai-setup" replace />} />
                <Route path="/agency/brain/:layer" element={<LegacyBrainLayerRedirect />} />
                <Route path="/ai/admin" element={<AgencyAiAdmin />} />
                <Route path="/ai/onboarding/agency" element={<AiOnboardingAgency />} />
                {/* Client Onboarding Routes */}
                <Route path="/onboarding/client/:clientId" element={<AiOnboardingClient />} />
                {/* Legacy route redirects for backwards compatibility */}
                <Route path="/ai/onboarding/client/:clientId" element={<AiOnboardingClient />} />
                <Route path="/onboarding/ai/client/:clientId" element={<AiOnboardingClient />} />
              </Route>

              {/* Client Detail Routes - No Sidebar */}
              <Route element={<ProtectedClientDetailShell />}>
                <Route path="/clients/:clientId" element={<ClientDetail />} />
                <Route path="/clients/:clientId/reports/:reportId" element={<ReportDetail />} />
              </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
