import React, { createContext, useContext, useState, useEffect } from "react";

export interface ClientUser {
  id: string;
  email: string;
  full_name: string | null;
  client_id: string;
  agency_id: string;
  role: 'client' | 'approver' | 'viewer';
}

interface ClientAuthContextType {
  clientUser: ClientUser | null;
  loading: boolean;
  login: (email: string, password: string, clientId: string) => Promise<void>;
  signup: (token: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

const CLIENT_AUTH_TOKEN_KEY = "client_auth_token";
const CLIENT_USER_KEY = "client_user";

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem(CLIENT_AUTH_TOKEN_KEY);
    const userStr = localStorage.getItem(CLIENT_USER_KEY);
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setClientUser(user);
      } catch (e) {
        localStorage.removeItem(CLIENT_AUTH_TOKEN_KEY);
        localStorage.removeItem(CLIENT_USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, clientId: string) => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password, client_id: clientId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const { token, user } = await response.json();
    localStorage.setItem(CLIENT_AUTH_TOKEN_KEY, token);
    localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
    setClientUser(user);
  };

  const signup = async (inviteToken: string, password: string, fullName?: string) => {
    console.log("Client-auth signup called");
    console.log("URL:", `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-signup`);
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-auth-signup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ invite_token: inviteToken, password, full_name: fullName }),
      }
    );

    console.log("Response status:", response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error("Signup error response:", error);
      throw new Error(error.error || "Signup failed");
    }

    const { token, user } = await response.json();
    console.log("Signup successful, user:", user);
    localStorage.setItem(CLIENT_AUTH_TOKEN_KEY, token);
    localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(user));
    setClientUser(user);
  };

  const logout = () => {
    localStorage.removeItem(CLIENT_AUTH_TOKEN_KEY);
    localStorage.removeItem(CLIENT_USER_KEY);
    setClientUser(null);
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
    throw new Error("useClientAuth must be used within a ClientAuthProvider");
  }
  return context;
}
