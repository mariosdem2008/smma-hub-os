import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/lib/client-auth";

export const useConversations = () => {
  const { clientUser, isAuthenticated } = useClientAuth();

  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      console.log("Fetching conversations...");

      // Check if client portal user
      const clientToken = typeof window !== "undefined" ? localStorage.getItem("client_auth_token") : null;

      if (clientUser && isAuthenticated && clientToken) {
        console.log("Using client portal authentication");

        // For client portal users - use JWT token
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-conversations`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientToken}`,
          },
          credentials: "include",
        });

        console.log("Client portal response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Client portal fetch error:", errorText);
          throw new Error("Failed to fetch conversations");
        }

        const data = await response.json();
        console.log("Client portal conversations:", data.conversations?.length || 0);
        return data.conversations || [];
      } else {
        // For Supabase auth users
        console.log("Using Supabase authentication");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          console.log("No Supabase session found");
          throw new Error("No active session");
        }

        console.log("Supabase session found, calling Edge Function...");

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-conversations`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        console.log("Supabase auth response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Supabase fetch error:", errorText);
          throw new Error("Failed to fetch conversations");
        }

        const data = await response.json();
        console.log("Supabase conversations:", data.conversations?.length || 0);
        return data.conversations || [];
      }
    },
    enabled: true,
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60, // 1 minute
  });
};
