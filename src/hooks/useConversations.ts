import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/lib/client-auth";

export const useConversations = () => {
  const { clientUser, isAuthenticated } = useClientAuth();

  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      // Check if client portal user
      const clientToken = typeof window !== "undefined" ? localStorage.getItem("client_auth_token") : null;

      if (clientUser && isAuthenticated) {
        // Use direct fetch with client portal token - IMPORTANT: Don't send apikey header
        // when using credentials: "include" - it causes CORS issues
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/list-conversations`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // This will send cookies with the request
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Failed to fetch conversations");
        }

        const data = await response.json();
        return data.conversations;
      } else {
        // Use Supabase auth for agency members
        const { data, error } = await supabase.functions.invoke("list-conversations");

        if (error) throw error;
        return data.conversations;
      }
    },
    enabled: isAuthenticated || true, // Adjust this based on your auth logic
  });
};
