import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AiOnboardingV3Guided } from "@/components/ai/AiOnboardingV3Guided";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function AiOnboardingClient() {
  const { clientId } = useParams();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgencyId();
  }, [clientId]);

  async function loadAgencyId() {
    try {
      if (!clientId) {
        setLoading(false);
        return;
      }

      // Get client to find agency_id
      const { data, error } = await supabase
        .from("clients")
        .select("agency_id")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      setAgencyId(data.agency_id);
    } catch (error) {
      console.error("Failed to load agency ID:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clientId || !agencyId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Invalid client or agency</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AiOnboardingV3Guided
        agencyId={agencyId}
        clientId={clientId}
        onboardingType="client"
      />
    </div>
  );
}
