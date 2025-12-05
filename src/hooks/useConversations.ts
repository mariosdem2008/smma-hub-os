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
        // For Supabase auth users, we need to use a different approach
        // because supabase.functions.invoke() automatically adds apikey header

        // Get the current session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("No active session");
        }

        // Make a direct fetch with the auth token, but without apikey
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/list-conversations`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Failed to fetch conversations");
        }

        const data = await response.json();
        return data.conversations;
      }
    },
    enabled: true,
  });
};
