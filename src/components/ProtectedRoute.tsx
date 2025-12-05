import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [authState, setAuthState] = useState<{
    loading: boolean;
    user: any | null;
    hasMembership: boolean | null;
  }>({
    loading: true,
    user: null,
    hasMembership: null,
  });

  useEffect(() => {
    // Don't re-check auth on every render, only when pathname changes
    let isMounted = true;

    const checkAuthAndMembership = async () => {
      if (!isMounted) return;

      try {
        // 1. Check session first
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (isMounted) {
            setAuthState({ loading: false, user: null, hasMembership: null });
          }
          return;
        }

        // 2. Check membership only if user exists
        const { data: membership } = await supabase
          .from("agency_members")
          .select("agency_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (isMounted) {
          setAuthState({
            loading: false,
            user: session.user,
            hasMembership: !!membership,
          });
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (isMounted) {
          setAuthState({ loading: false, user: null, hasMembership: null });
        }
      }
    };

    // Debounce the check to prevent rapid calls
    const timeoutId = setTimeout(checkAuthAndMembership, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [location.pathname]); // Only re-run when route actually changes

  // Show loading state
  if (authState.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect to auth if no user
  if (!authState.user) {
    // Store where they were trying to go
    if (location.pathname !== "/auth") {
      sessionStorage.setItem("redirectUrl", location.pathname);
    }
    return <Navigate to="/auth" replace />;
  }

  // Handle membership logic
  const hasMembership = authState.hasMembership === true;

  // If no membership and not on onboarding, redirect
  if (!hasMembership && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If has membership and is on onboarding, redirect to dashboard
  if (hasMembership && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
