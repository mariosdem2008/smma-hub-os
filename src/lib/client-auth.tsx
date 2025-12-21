import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientUser {
  id: string;
  email: string;
  full_name: string | null;
  client_id: string;
  agency_id: string;
  role: "client" | "approver" | "viewer";
}

interface ClientAuthContextType {
  clientUser: ClientUser | null;
  loading: boolean;
  login: (email: string, password: string, clientId: string) => Promise<void>;
  signup: (
    token: string,
    password: string,
    fullName?: string,
  ) => Promise<{ portalSlug: string | null; clientId: string | null }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  const clearRefreshTimeout = () => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  };

  const clearSession = () => {
    clearRefreshTimeout();
    setClientUser(null);
    setTokenExpiry(null);
  };

  const scheduleRefresh = (exp: number) => {
    clearRefreshTimeout();

    const nowSec = Math.floor(Date.now() / 1000);
    const refreshAt = exp - 5 * 60; // 5 minutes before expiry
    const delayMs = Math.max((refreshAt - nowSec) * 1000, 0);

    if (delayMs === 0) {
      // Token is expiring or expired, refresh immediately
      refreshSession();
      return;
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshSession();
    }, delayMs);
  };

  const handleAuthResponse = (data: { user: ClientUser; exp: number }) => {
    setClientUser(data.user);
    setTokenExpiry(data.exp);
    scheduleRefresh(data.exp);
  };

  const refreshSession = useCallback(async () => {
    try {
      if (typeof document !== "undefined" && !document.cookie.includes("cp_refresh_token=")) {
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-refresh-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        credentials: "include",
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        data = {};
      }

      if (!response.ok || !data.user || !data.exp) {
        console.error("Failed to refresh client portal session", {
          status: response.status,
          bodyText: text,
          bodyObj: data,
        });
        clearSession();
        return;
      }

      handleAuthResponse(data as any);
    } catch (error) {
      console.error("Failed to refresh client portal session", error);
      clearSession();
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await refreshSession();
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      clearRefreshTimeout();
    };
  }, [refreshSession]);

  const login = async (email: string, password: string, clientId: string) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      credentials: "include",
      body: JSON.stringify({ email, password, client_id: clientId }),
    });

    const bodyText = await response.text();
    let bodyObj: any = {};
    try {
      bodyObj = bodyText ? JSON.parse(bodyText) : {};
    } catch (_) {
      bodyObj = {};
    }

    if (!response.ok || !bodyObj.user || !bodyObj.exp) {
      console.error("Login failed", { status: response.status, bodyText, bodyObj });
      const errMsg = bodyObj?.error || bodyObj?.message || bodyText || "Login failed";
      throw new Error(errMsg);
    }

    handleAuthResponse(bodyObj);

    try {
      await supabase.auth.signInWithPassword({ email, password });
    } catch (authErr) {
      console.error("[client-auth] supabase auth sign-in failed", authErr);
    }
  };

  const signup = async (
    inviteToken: string,
    password: string,
    fullName?: string,
  ): Promise<{ portalSlug: string | null; clientId: string | null }> => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      credentials: "include",
      body: JSON.stringify({ invite_token: inviteToken, password, full_name: fullName }),
    });

    const bodyText = await response.text();
    let bodyObj: any = {};
    try {
      bodyObj = bodyText ? JSON.parse(bodyText) : {};
    } catch (_) {
      bodyObj = {};
    }

    if (!response.ok || !bodyObj.user || !bodyObj.exp) {
      console.error("Signup error response:", { status: response.status, bodyText, bodyObj });
      const errMsg = bodyObj?.error || bodyObj?.message || bodyText || "Signup failed";
      throw new Error(errMsg);
    }

    handleAuthResponse(bodyObj);

    const portalSlug = bodyObj.portal_slug ?? bodyObj.portalSlug ?? null;
    const clientId = bodyObj?.client_id ?? bodyObj?.user?.client_id ?? null;

    if (portalSlug) {
      console.log("[client-auth] signup returned portal_slug:", portalSlug);
    }

    if (bodyObj?.user?.email) {
      try {
        await supabase.auth.signInWithPassword({ email: bodyObj.user.email, password });
      } catch (authErr) {
        console.error("[client-auth] supabase auth sign-in after signup failed", authErr);
      }
    }

    return { portalSlug, clientId };
  };

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        credentials: "include",
      });
    } catch (error) {
      console.error("Client portal logout failed", error);
    } finally {
      clearSession();
    }
  };

  return (
    <ClientAuthContext.Provider
      value={{
        clientUser,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!clientUser,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (context === undefined) {
    if (typeof window !== "undefined") {
      console.warn("[ClientAuth] used without provider; returning fallback (may limit functionality)");
    }
    return {
      clientUser: null,
      loading: false,
      login: async () => {
        throw new Error("Client auth not available");
      },
      signup: async (): Promise<{ portalSlug: string | null; clientId: string | null }> => {
        throw new Error("Client auth not available");
      },
      logout: async () => {},
      isAuthenticated: false,
    };
  }
  return context;
}
