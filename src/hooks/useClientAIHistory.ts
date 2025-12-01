import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AIHistoryRow = Database["public"]["Tables"]["ai_history"]["Row"];

export interface ClientAIHistory {
  all: AIHistoryRow[];
  ideas: AIHistoryRow[];
  hooks: AIHistoryRow[];
  captions: AIHistoryRow[];
  scripts: AIHistoryRow[];
  rewrites: AIHistoryRow[];
}

interface UseClientAIHistoryResult {
  data: ClientAIHistory | null;
  loading: boolean;
  error: string | null;
}

export function useClientAIHistory(clientId: string | null): UseClientAIHistoryResult {
  const [data, setData] = useState<ClientAIHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    let isMounted = true;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      const { data: rows, error } = await supabase
        .from("ai_history")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load AI history", error);
        setError(error.message);
        setLoading(false);
        return;
      }

      const ideas = (rows || []).filter((row) => row.mode === "ideas");
      const hooks = (rows || []).filter((row) => row.mode === "hook");
      const captions = (rows || []).filter((row) => row.mode === "caption");
      const scripts = (rows || []).filter((row) => row.mode === "script");
      const rewrites = (rows || []).filter((row) => row.mode === "rewrite");

      setData({
        all: rows || [],
        ideas,
        hooks,
        captions,
        scripts,
        rewrites,
      });
      setLoading(false);
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  return { data, loading, error };
}
