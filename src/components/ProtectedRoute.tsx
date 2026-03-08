import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getActiveAgencyId } from "@/lib/active-agency";
import { supabase } from "@/integrations/supabase/client";

const DEBUG = false;
const TIMEOUT_MS = 12000;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, session, loading: authLoading } = useAuth();
  const sessionExpiresAtMs = session?.expires_at ? session.expires_at * 1000 : null;
  const hasValidSession = session
    ? (!sessionExpiresAtMs || sessionExpiresAtMs > Date.now())
    : Boolean(user);
  const isAuthenticated = Boolean(user && hasValidSession);

  const [membershipStatus, setMembershipStatus] = useState<"loading" | "has" | "none">("loading");
  const [onboardingStatus, setOnboardingStatus] = useState<"loading" | "complete" | "incomplete">("loading");
  const [timedOut, setTimedOut] = useState(false);

  // Reset timeout when loading completes
  useEffect(() => {
    if (!authLoading && membershipStatus !== "loading") {
      setTimedOut(false);
    }
  }, [authLoading, membershipStatus]);

  // Global timeout - prevents infinite loading
  useEffect(() => {
    if (!authLoading && membershipStatus !== "loading") return;

    const timeout = setTimeout(() => {
      if (authLoading || membershipStatus === "loading") {
        if (DEBUG) console.warn("[ProtectedRoute] Timeout - forcing resolution");
        setTimedOut(true);
        setMembershipStatus("none");
      }
    }, TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [authLoading, membershipStatus]);

  useEffect(() => {
    // Keep guard state pending until auth has definitively resolved.
    if (authLoading) {
      setMembershipStatus("loading");
      setOnboardingStatus("loading");
      return;
    }

    if (!isAuthenticated) {
      setMembershipStatus("none");
      setOnboardingStatus("incomplete");
      return;
    }

    const activeAgencyId = getActiveAgencyId();
    setMembershipStatus(activeAgencyId ? "has" : "none");
  }, [authLoading, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const activeAgencyId = getActiveAgencyId();
    if (!activeAgencyId) {
      setOnboardingStatus("incomplete");
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from("ai_onboarding_status")
          .select("status")
          .eq("agency_id", activeAgencyId)
          .eq("scope", "agency")
          .is("client_id", null)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          setOnboardingStatus("incomplete");
          return;
        }
        setOnboardingStatus(data?.status === "complete" ? "complete" : "incomplete");
      } catch {
        if (!cancelled) setOnboardingStatus("incomplete");
      }
    };

    setOnboardingStatus("loading");
    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // === RENDER LOGIC ===

  // Timeout state - show retry
  if (timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4 bg-background">
        <p className="text-muted-foreground">Connection timed out. Please check your network.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  // Still loading auth or membership.
  // Onboarding status only blocks when a user is present.
  if (authLoading || membershipStatus === "loading" || (isAuthenticated && onboardingStatus === "loading")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> redirect to auth
  if (!isAuthenticated) {
    if (location.pathname !== "/auth") {
      sessionStorage.setItem("redirectUrl", location.pathname);
    }
    return <Navigate to="/auth" replace />;
  }

  // Logged in but no membership -> onboarding
  const allowNoAgencyPaths = new Set(["/bootstrap", "/welcome", "/select-agency", "/create-agency", "/invitations"]);
  const allowOnboardingPaths = new Set([
    ...allowNoAgencyPaths,
    "/ai/onboarding/agency",
  ]);

  if (membershipStatus === "none" && !allowNoAgencyPaths.has(location.pathname)) {
    return <Navigate to="/bootstrap" replace />;
  }

  if (membershipStatus === "has" && onboardingStatus === "incomplete" && !allowOnboardingPaths.has(location.pathname)) {
    return <Navigate to="/ai/onboarding/agency" replace />;
  }

  return <>{children}</>;
}
