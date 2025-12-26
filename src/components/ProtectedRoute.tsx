import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getActiveAgencyId } from "@/lib/active-agency";

const DEBUG = false;
const TIMEOUT_MS = 12000;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [membershipStatus, setMembershipStatus] = useState<"loading" | "has" | "none">("loading");
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
    if (!user) {
      setMembershipStatus("none");
      return;
    }

    const activeAgencyId = getActiveAgencyId();
    setMembershipStatus(activeAgencyId ? "has" : "none");
  }, [user?.id]);

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

  // Still loading auth or membership
  if (authLoading || membershipStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in → redirect to auth
  if (!user) {
    if (location.pathname !== "/auth") {
      sessionStorage.setItem("redirectUrl", location.pathname);
    }
    return <Navigate to="/auth" replace />;
  }

  // Logged in but no membership → onboarding
  const allowNoAgencyPaths = new Set(["/bootstrap", "/welcome", "/select-agency", "/create-agency", "/invitations"]);

  if (membershipStatus === "none" && !allowNoAgencyPaths.has(location.pathname)) {
    return <Navigate to="/bootstrap" replace />;
  }

  // Has membership but on onboarding → dashboard
  return <>{children}</>;
}
