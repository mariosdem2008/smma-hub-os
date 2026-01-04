import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StrategyDocumentRecord } from "@/lib/strategy/types";

export const strategyDocumentsKeys = {
  all: ["strategy-documents"] as const,
  byClient: (clientId: string) => [...strategyDocumentsKeys.all, clientId] as const,
};

export function useStrategyDocuments(clientId: string | undefined) {
  return useQuery({
    queryKey: strategyDocumentsKeys.byClient(clientId ?? ""),
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("strategy_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as StrategyDocumentRecord[];
    },
    enabled: !!clientId,
  });
}

export function useActivateStrategyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, documentId }: { clientId: string; documentId: string }) => {
      const { error: deactivateError } = await supabase
        .from("strategy_documents")
        .update({ is_active: false })
        .eq("client_id", clientId);

      if (deactivateError) throw deactivateError;

      const { data, error } = await supabase
        .from("strategy_documents")
        .update({ is_active: true })
        .eq("id", documentId)
        .select()
        .single();

      if (error) throw error;
      return data as StrategyDocumentRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: strategyDocumentsKeys.byClient(data.client_id) });
    },
  });
}

export function useGenerateStrategyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      instruction,
    }: {
      clientId: string;
      instruction?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("ai-strategy-generate", {
        body: { client_id: clientId, instruction },
      });

      if (error) throw error;
      return data as { document: StrategyDocumentRecord | null };
    },
    onSuccess: (data) => {
      if (!data?.document) return;
      queryClient.invalidateQueries({
        queryKey: strategyDocumentsKeys.byClient(data.document.client_id),
      });
    },
  });
}

export function useUploadStrategyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      agencyId,
      file,
    }: {
      clientId: string;
      agencyId: string;
      file: File;
    }) => {
      const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "txt";
      const fileName = `${agencyId}/${clientId}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("strategy-documents")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError && !uploadError.message.includes("Bucket not found")) {
        throw uploadError;
      }

      let contentMarkdown: string | null = null;
      if (
        file.type === "text/markdown" ||
        file.type === "text/plain" ||
        file.name.toLowerCase().endsWith(".md") ||
        file.name.toLowerCase().endsWith(".txt")
      ) {
        contentMarkdown = await file.text();
      }

      const { data: publicUrlData } = uploadData?.path
        ? supabase.storage.from("strategy-documents").getPublicUrl(uploadData.path)
        : { data: null };

      if (!contentMarkdown) {
        const link = publicUrlData?.publicUrl ? `\n\n[Open file](${publicUrlData.publicUrl})` : "";
        contentMarkdown = `# Uploaded Strategy Document\n\nFile: ${file.name}${link}`;
      }

      const { error: deactivateError } = await supabase
        .from("strategy_documents")
        .update({ is_active: false })
        .eq("client_id", clientId);

      if (deactivateError) throw deactivateError;

      const { data, error } = await supabase
        .from("strategy_documents")
        .insert({
          agency_id: agencyId,
          client_id: clientId,
          content_markdown: contentMarkdown,
          content_html: null,
          source: "upload",
          is_active: true,
          file_path: uploadData?.path ?? null,
          file_name: file.name,
        })
        .select()
        .single();

      if (error) throw error;
      return data as StrategyDocumentRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: strategyDocumentsKeys.byClient(data.client_id) });
    },
  });
}
