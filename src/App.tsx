import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ClientAuthProvider } from "@/lib/client-auth";
import { UpgradeModalProvider } from "@/contexts/UpgradeModalContext";
import { UpgradeAssistantProvider } from "@/contexts/UpgradeAssistantContext";

// Pages
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Messages from "@/pages/Messages";
import Settings from "@/pages/Settings";
import Team from "@/pages/Team";
import Onboarding from "@/pages/Onboarding";
import InviteAccept from "@/pages/InviteAccept";
import Billing from "@/pages/Billing";
import BillingOverview from "@/pages/BillingOverview";
import Pricing from "@/pages/Pricing";
import NotFound from "@/pages/NotFound";

// Client Portal Pages
import { ClientPortalLayout } from "@/pages/ClientPortalLayout";
import ClientLogin from "@/pages/client/ClientLogin";
import ClientForgotPassword from "@/pages/client/ClientForgotPassword";
import ClientResetPassword from "@/pages/client/ClientResetPassword";
import ClientAcceptInvite from "@/pages/client/ClientAcceptInvite";

// Protected Route
import { ProtectedRoute } from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

function App() {
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
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/invite/:token" element={<InviteAccept />} />

                    {/* Protected agency routes */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/clients"
                      element={
                        <ProtectedRoute>
                          <Clients />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/clients/:clientId"
                      element={
                        <ProtectedRoute>
                          <ClientDetail />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/clients/:clientId/reports/:reportId"
                      element={
                        <ProtectedRoute>
                          <ClientDetail />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/messages"
                      element={
                        <ProtectedRoute>
                          <Messages />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/team"
                      element={
                        <ProtectedRoute>
                          <Team />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <Settings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/billing"
                      element={
                        <ProtectedRoute>
                          <Billing />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/billing/overview"
                      element={
                        <ProtectedRoute>
                          <BillingOverview />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/onboarding"
                      element={
                        <ProtectedRoute>
                          <Onboarding />
                        </ProtectedRoute>
                      }
                    />

                    {/* Client portal auth routes */}
                    <Route path="/portal/:slug/login" element={<ClientLogin />} />
                    <Route path="/portal/:slug/forgot-password" element={<ClientForgotPassword />} />
                    <Route path="/portal/:slug/reset-password" element={<ClientResetPassword />} />
                    <Route path="/client/accept-invite/:token" element={<ClientAcceptInvite />} />

                    {/* Client portal protected routes */}
                    <Route path="/portal/:slug/*" element={<ClientPortalLayout />} />

                    {/* Fallback */}
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
}

export default App;
