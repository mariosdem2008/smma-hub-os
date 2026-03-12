import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useHasSupabaseSession() {
  const [hasSession, setHasSession] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setHasSession(Boolean(data.session));
      setLoading(false);
    };

    resolve();

    return () => {
      active = false;
    };
  }, []);

  return { hasSession, loading };
}
