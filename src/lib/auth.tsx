import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (initialized.current) return;
    initialized.current = true;

    let mounted = true;

    // Setup auth state listener FIRST (before getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;

      // Synchronous state updates only - no async calls here
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
    });

    // Then check for existing session
    const initSession = async () => {
      try {
        // Handle OAuth code exchange if present
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
          } catch (e) {
            console.warn("[Auth] Code exchange failed:", e);
          } finally {
            url.searchParams.delete("code");
            window.history.replaceState({}, document.title, url.toString());
          }
        }

        // Get cached session
        const { data, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.warn("[Auth] getSession error:", error.message);
          setLoading(false);
          return;
        }

        // Set session from storage (onAuthStateChange will also fire)
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
        
        setLoading(false);
      } catch (e) {
        console.warn("[Auth] Init error:", e);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/bootstrap`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error) {
      const redirectUrl = sessionStorage.getItem("redirectUrl");
      sessionStorage.removeItem("redirectUrl");
      navigate(redirectUrl || "/bootstrap", { replace: true });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    sessionStorage.removeItem("redirectUrl");
    navigate("/auth", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
