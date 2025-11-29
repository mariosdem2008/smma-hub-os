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
import { UpgradeAssistantBubble } from "@/components/UpgradeAssistantBubble";
import { UpgradeAssistantCard } from "@/components/UpgradeAssistantCard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { useTimezoneDetection } from "@/hooks/useTimezoneDetection";
import Landing from "./pages/Landing";
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
import NotFound from "./pages/NotFound";
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

const queryClient = new QueryClient();

const App = () => {
  // Initialize timezone detection
  useTimezoneDetection();
  
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClientAuthProvider>
            <UpgradeModalProvider>
              <UpgradeAssistantProvider>
                <GlobalUpgradeModal />
                <UpgradeAssistantCard />
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/invite/:token" element={<InviteAccept />} />
                  
                  {/* Client Portal Auth Routes */}
                  <Route path="/client/login/:portalSlug" element={<ClientLogin />} />
                  <Route path="/client/accept-invite" element={<ClientAcceptInvite />} />
                  <Route path="/client/forgot-password/:portalSlug" element={<ClientForgotPassword />} />
                  <Route path="/client/reset-password" element={<ClientResetPassword />} />
                  
                  {/* Client Portal Protected Routes */}
                  <Route path="/client/portal/:portalSlug" element={<ClientPortalLayout />}>
                    <Route index element={<PortalOverview />} />
                    <Route path="approvals" element={<PortalApprovals />} />
                    <Route path="content-calendar" element={<PortalContentCalendar />} />
                    <Route path="ideas" element={<PortalIdeas />} />
                    <Route path="assets" element={<PortalAssets />} />
                    <Route path="branding" element={<PortalBranding />} />
                    <Route path="social" element={<PortalSocial />} />
                    <Route path="social-profiles" element={<PortalSocialProfiles />} />
                    <Route path="uploads" element={<PortalUploads />} />
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
                  
                  {/* Protected App Routes */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/clients/:clientId" element={<ClientDetail />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/billing/overview" element={<BillingOverview />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </UpgradeAssistantProvider>
            </UpgradeModalProvider>
          </ClientAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
