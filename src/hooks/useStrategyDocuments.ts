import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StrategyDocumentRecord } from "@/lib/strategy/types";
import { parseEdgeFunctionResponse } from "@/lib/edgeFunctionError";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";

async function readFunctionErrorPayload(error: unknown): Promise<{ code?: string; error?: string; message?: string } | null> {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: Response }).context;
  if (!context || typeof (context as any).json !== "function") return null;
  try {
    return (await (context as any).json()) as { code?: string; error?: string; message?: string };
  } catch {
    return null;
  }
}

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
  const { toast } = useToast();
  const navigate = useNavigate();

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

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        const code = payload?.code ?? "EDGE_FUNCTION_ERROR";
        const message =
          payload?.message ?? payload?.error ?? (error instanceof Error ? error.message : "Failed to call strategy generation");

        toast({
          variant: "destructive",
          title: "Strategy Generation Failed",
          description: message,
        });

        const err: any = new Error(message);
        err.code = code;
        throw err;
      }

      const parsed = parseEdgeFunctionResponse<{
        document?: StrategyDocumentRecord | null;
        unknown?: boolean;
        [key: string]: unknown;
      }>(data);

      if (!parsed.success && parsed.error) {
        const err = parsed.error;

        toast({
          variant: "destructive",
          title: "Strategy Generation Failed",
          description: err.message,
          action: err.deepLink
            ? createElement(ToastAction, { altText: "Fix now", onClick: () => navigate(err.deepLink!) }, "Fix Now")
            : undefined,
        });

        const thrown: any = new Error(err.message);
        thrown.code = err.code;
        thrown.deepLink = err.deepLink;
        thrown.missingFields = err.missingFields;
        throw thrown;
      }

      const document = (parsed.result?.document ?? null) as StrategyDocumentRecord | null;
      if (!document) {
        toast({
          variant: "destructive",
          title: "Strategy Generation Failed",
          description: "Strategy generation did not return a document.",
        });
        const err: any = new Error("Strategy generation did not return a document.");
        err.code = "MISSING_DOCUMENT";
        throw err;
      }

      return { document };
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
