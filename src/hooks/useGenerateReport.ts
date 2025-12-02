import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GenerateReportParams {
  clientId: string;
  agencyId: string;
  month: string;
}

export function useGenerateReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, agencyId, month }: GenerateReportParams) => {
      const { data, error } = await supabase.functions.invoke('generate-monthly-report', {
        body: {
          client_id: clientId,
          agency_id: agencyId,
          month,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate report');

      return data.report;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Report Generated",
        description: "Monthly report has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["client-reports", variables.clientId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}