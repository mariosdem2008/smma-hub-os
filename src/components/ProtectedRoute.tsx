import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { db } from "@/data";
import { Button } from "@/components/ui/button";

const DEBUG = false;
const TIMEOUT_MS = 12000;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [membershipStatus, setMembershipStatus] = useState<"loading" | "has" | "none">("loading");
  const [timedOut, setTimedOut] = useState(false);
  const checkedUserRef = useRef<string | null>(null);

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

  // Check membership ONLY when user.id changes (not on every route)
  useEffect(() => {
    // No user = no membership
    if (!user) {
      setMembershipStatus("none");
      checkedUserRef.current = null;
      return;
    }

    // Already checked this user
    if (checkedUserRef.current === user.id) {
      return;
    }

    let cancelled = false;
    setMembershipStatus("loading");

    const checkMembership = async () => {
      try {
        const membership = await db.from("agency_members")
          .select("agency_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (membership.error) {
          if (DEBUG) console.warn("[ProtectedRoute] Membership check error:", membership.error);
          // On error, allow access to prevent loops
          setMembershipStatus("has");
        } else {
          setMembershipStatus(membership.data ? "has" : "none");
        }
        
        checkedUserRef.current = user.id;
      } catch (err) {
        if (DEBUG) console.warn("[ProtectedRoute] Exception:", err);
        if (!cancelled) {
          setMembershipStatus("has"); // Allow on error
          checkedUserRef.current = user.id;
        }
      }
    };

    checkMembership();
    return () => { cancelled = true; };
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
  if (membershipStatus === "none" && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Has membership but on onboarding → dashboard
  if (membershipStatus === "has" && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
