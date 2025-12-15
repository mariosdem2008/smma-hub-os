import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

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

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const forceLocalSignOut = async () => {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}
      if (!mounted) return;
      setSession(null);
      setUser(null);
    };

    const initAuth = async () => {
      try {
        // 1) Exchange email link code -> session (if present)
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          try {
            // IMPORTANT: exchangeCodeForSession expects the code, not the whole URL
            await supabase.auth.exchangeCodeForSession(code);
          } catch (e) {
            console.warn("[AuthProvider] exchangeCodeForSession error:", e);
          } finally {
            url.searchParams.delete("code");
            window.history.replaceState({}, document.title, url.toString());
          }
        }

        // 2) Read cached session (fast)
        const { data: sessData } = await supabase.auth.getSession();
        const sess = sessData.session ?? null;

        if (!mounted) return;

        // ✅ UNBLOCK UI IMMEDIATELY
        setSession(sess);
        setUser(sess?.user ?? null);
        setLoading(false);

        // 3) Validate in background (never block render)
        if (sess) {
          supabase.auth.getUser().then(async ({ data, error }) => {
            if (!mounted) return;
            if (error || !data.user) {
              await forceLocalSignOut();
            } else {
              setUser(data.user);
            }
          });
        }
      } catch (e) {
        console.warn("[AuthProvider] initAuth error:", e);
        if (mounted) setLoading(false);
      }
    };


    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (!mounted) return;

      // If signed out, clear immediately
      if (!sess) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // Validate on important events (prevents “phantom login”)
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData.user) {
          await forceLocalSignOut();
          setLoading(false);
          return;
        }
        setSession(sess);
        setUser(userData.user);
        setLoading(false);
        return;
      }

      // Default fallback
      setSession(sess);
      setUser(sess.user ?? null);
      setLoading(false);
    });

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/onboarding`;

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
      navigate(redirectUrl || "/dashboard", { replace: true });
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
