import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { toast } from "sonner";
import type { BrainModule, BrainDocumentSource } from "@/lib/ai/brainContracts";
import { BRAIN_MODULE_LABELS } from "@/lib/ai/brainModules";

interface UploadAndAnalyzeParams {
  file: File;
  module: BrainModule;
  mode: "transformed" | "original";
  onProgress?: (progress: number) => void;
}

interface AnalyzeDocumentResponse {
  extracted_text: string;
  transformed_output: Record<string, unknown>;
  format: "json" | "markdown" | "text";
  warnings: string[];
}

/**
 * Hook for uploading and analyzing brain documents
 */
export function useBrainDocumentUpload() {
  const queryClient = useQueryClient();
  const { agencyId } = useAgency();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, module, mode, onProgress }: UploadAndAnalyzeParams) => {
      if (!agencyId) throw new Error("No agency selected");

      // Step 1: Upload file to storage
      const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "txt";
      const fileName = `${agencyId}/${module}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;

      onProgress?.(0.1);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("brain-documents")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        // If bucket doesn't exist, try to create it or use fallback
        if (uploadError.message.includes("Bucket not found")) {
          // For now, we'll store the content directly without file storage
          console.warn("brain-documents bucket not found, proceeding without file storage");
        } else {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }
      }

      onProgress?.(0.3);

      // Step 2: Call AI analyze endpoint
      const { data: analyzeResult, error: analyzeError } = await supabase.functions.invoke(
        "ai-brain-analyze",
        {
          body: {
            agency_id: agencyId,
            layer: module,
            mode,
            file_path: uploadData?.path ?? null,
            file_name: file.name,
            file_type: file.type,
          },
        }
      );

      onProgress?.(0.7);

      if (analyzeError) {
        // If edge function doesn't exist yet, create document with extracted text only
        console.warn("ai-brain-analyze function not available, using fallback");

        // Read file content for text files
        let extractedText = "";
        if (file.type === "text/plain" || file.type === "text/markdown" || file.name.endsWith(".md") || file.name.endsWith(".txt")) {
          extractedText = await file.text();
        } else {
          extractedText = `[Content extracted from ${file.name}]\n\nThis document requires server-side processing to extract text content.`;
        }

        // Create document with basic content
        return await createBrainDocument({
          agencyId,
          module,
          extractedText,
          transformedOutput: null,
          source: "manual",
          filePath: uploadData?.path ?? null,
        });
      }

      onProgress?.(0.9);

      // Step 3: Create brain document with the analyzed content
      const result = analyzeResult as AnalyzeDocumentResponse;
      const contentToStore = mode === "transformed" && result.transformed_output
        ? result.transformed_output
        : { raw_content: result.extracted_text };

      const document = await createBrainDocument({
        agencyId,
        module,
        extractedText: result.extracted_text,
        transformedOutput: contentToStore,
        source: "manual", // Will be updated to "upload_ai" when we have the edge function
        filePath: uploadData?.path ?? null,
        warnings: result.warnings,
      });

      onProgress?.(1);

      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      queryClient.invalidateQueries({ queryKey: ["brain-document"] });
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const uploadAndAnalyze = useCallback(
    async (params: UploadAndAnalyzeParams) => {
      return uploadMutation.mutateAsync(params);
    },
    [uploadMutation]
  );

  return {
    uploadAndAnalyze,
    isUploading: uploadMutation.isPending,
    error: uploadMutation.error,
  };
}

interface CreateBrainDocumentParams {
  agencyId: string;
  module: BrainModule;
  extractedText: string;
  transformedOutput: Record<string, unknown> | null;
  source: BrainDocumentSource;
  filePath: string | null;
  warnings?: string[];
}

async function createBrainDocument({
  agencyId,
  module,
  extractedText,
  transformedOutput,
  source,
  filePath,
  warnings,
}: CreateBrainDocumentParams) {
  const title = BRAIN_MODULE_LABELS[module];
  const contentJson = transformedOutput ?? { raw_content: extractedText };

  // Create the brain document
  const { data: document, error: insertError } = await supabase
    .from("brain_documents")
    .insert({
      agency_id: agencyId,
      module,
      title,
      content_json: contentJson,
      status: "draft",
      source,
    })
    .select()
    .single();

  if (insertError) throw new Error(`Failed to create document: ${insertError.message}`);

  // Create initial version
  await supabase.from("brain_document_versions").insert({
    document_id: document.id,
    version: 1,
    content_json: contentJson,
    change_summary: `Uploaded from ${filePath ?? "file"}`,
  });

  return document;
}
