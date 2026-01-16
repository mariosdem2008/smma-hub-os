import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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

import Landing from "./pages/LandingV2";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Billing from "./pages/Billing";
import BillingOverview from "./pages/BillingOverview";
import InviteAccept from "./pages/InviteAccept";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";
import AiOnboardingAgency from "./pages/ai/AiOnboardingAgency";
import AiOnboardingClient from "./pages/ai/AiOnboardingClientV4";
import AgencyAiAdmin from "./pages/ai/AgencyAiAdmin";
import AgencyBrain from "./pages/agency/AgencyBrain";
import BrainLayerDetail from "./pages/agency/BrainLayerDetail";
import Bootstrap from "./pages/Bootstrap";
import Welcome from "./pages/Welcome";
import SelectAgency from "./pages/SelectAgency";
import CreateAgencyStub from "./pages/CreateAgencyStub";
import Invitations from "./pages/Invitations";

import { ClientPortalLayout } from "./pages/ClientPortalLayout";
import ClientLogin from "./pages/client/ClientLogin";
import ClientAcceptInvite from "./pages/client/ClientAcceptInvite";
import ClientForgotPassword from "./pages/client/ClientForgotPassword";
import ClientResetPassword from "./pages/client/ClientResetPassword";

import { PortalOverview } from "./pages/client-portal/PortalOverview";
import { PortalBranding } from "./pages/client-portal/PortalBranding";
import { PortalSocial } from "./pages/client-portal/PortalSocial";
import PortalSocialProfiles from "./pages/client-portal/PortalSocialProfiles";
import { PortalIdeas } from "./pages/client-portal/PortalIdeas";
import { PortalAssets } from "./pages/client-portal/PortalAssets";
import { PortalContentCalendar } from "./pages/client-portal/PortalContentCalendar";
import PortalUploads from "./pages/client-portal/PortalUploads";
import PortalApprovals from "./pages/client-portal/PortalApprovals";
import PortalMessages from "./pages/client-portal/PortalMessages";
import { PortalPerformance } from "./pages/client-portal/PortalPerformance";
import ReportDetail from "./components/client-tabs/ReportDetail";
import { PortalAiAssistant } from "./pages/client-portal/PortalAiAssistant";

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

function ClientPortalShell() {
  return (
    <ClientAuthProvider>
      <ClientPortalLayout />
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
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/invite/:token" element={<InviteAccept />} />

              {/* Client Portal Auth Routes (public) */}
              <Route
                path="/client/login/:portalSlug"
                element={
                  <ClientAuthProvider>
                    <ClientLogin />
                  </ClientAuthProvider>
                }
              />
              <Route
                path="/client/accept-invite"
                element={
                  <ClientAuthProvider>
                    <ClientAcceptInvite />
                  </ClientAuthProvider>
                }
              />
              <Route
                path="/client/forgot-password/:portalSlug"
                element={
                  <ClientAuthProvider>
                    <ClientForgotPassword />
                  </ClientAuthProvider>
                }
              />
              <Route
                path="/client/reset-password"
                element={
                  <ClientAuthProvider>
                    <ClientResetPassword />
                  </ClientAuthProvider>
                }
              />

              {/* Client Portal Protected Routes (scoped provider) */}
              <Route path="/client/portal" element={<ClientPortalShell />}>
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
              <Route path="/client/portal/:portalSlug" element={<ClientPortalShell />}>
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

              {/* Onboarding */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
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

              {/* Protected App Routes */}
              <Route element={<ProtectedAppShell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/team" element={<Team />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/billing/overview" element={<BillingOverview />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/agency/brain" element={<AgencyBrain />} />
                <Route path="/agency/brain/:layer" element={<BrainLayerDetail />} />
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
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
