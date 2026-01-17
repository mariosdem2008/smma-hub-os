import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { toast } from "sonner";
import type {
  BrainDocument,
  BrainDocumentVersion,
  BrainModule,
  BrainDocumentSource,
  BrainDocumentContent,
} from "@/lib/ai/brainContracts";

/**
 * Hook for fetching all brain documents for the current agency
 */
export function useBrainDocuments() {
  const { agencyId } = useAgency();

  return useQuery({
    queryKey: ["brain-documents", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data, error } = await supabase
        .from("brain_documents")
        .select("*")
        .eq("agency_id", agencyId)
        .neq("status", "archived")
        .order("module")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as BrainDocument[];
    },
    enabled: !!agencyId,
  });
}

/**
 * Hook for fetching approved brain documents only
 */
export function useApprovedBrainDocuments() {
  const { agencyId } = useAgency();

  return useQuery({
    queryKey: ["brain-documents", "approved", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data, error } = await supabase
        .from("brain_documents")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("status", "approved")
        .order("module");

      if (error) throw error;
      return (data ?? []) as BrainDocument[];
    },
    enabled: !!agencyId,
  });
}

/**
 * Hook for fetching a specific brain document by module
 */
export function useBrainDocument(module: BrainModule) {
  const { agencyId } = useAgency();

  return useQuery({
    queryKey: ["brain-document", agencyId, module],
    queryFn: async () => {
      if (!agencyId) return null;

      // Try approved first
      const { data: approved } = await supabase
        .from("brain_documents")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("module", module)
        .eq("status", "approved")
        .maybeSingle();

      if (approved) return approved as BrainDocument;

      // Fall back to latest draft
      const { data: draft } = await supabase
        .from("brain_documents")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("module", module)
        .in("status", ["draft", "pending_approval"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return (draft as BrainDocument) ?? null;
    },
    enabled: !!agencyId,
  });
}

/**
 * Hook for fetching version history of a document
 */
export function useBrainDocumentHistory(documentId: string | null) {
  return useQuery({
    queryKey: ["brain-document-history", documentId],
    queryFn: async () => {
      if (!documentId) return [];

      const { data, error } = await supabase
        .from("brain_document_versions")
        .select("*")
        .eq("document_id", documentId)
        .order("version", { ascending: false });

      if (error) throw error;
      return (data ?? []) as BrainDocumentVersion[];
    },
    enabled: !!documentId,
  });
}

/**
 * Hook for creating a brain document draft
 */
export function useCreateBrainDocumentDraft() {
  const queryClient = useQueryClient();
  const { agencyId } = useAgency();

  return useMutation({
    mutationFn: async ({
      module,
      title,
      contentJson,
      source = "manual",
    }: {
      module: BrainModule;
      title: string;
      contentJson: BrainDocumentContent;
      source?: BrainDocumentSource;
    }) => {
      if (!agencyId) throw new Error("No agency selected");

      const { data, error } = await supabase
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

      if (error) throw error;

      // Create initial version
      await supabase.from("brain_document_versions").insert({
        document_id: data.id,
        version: 1,
        content_json: contentJson,
        change_summary: "Initial draft created",
      });

      return data as BrainDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      queryClient.invalidateQueries({ queryKey: ["brain-document"] });
      toast.success("Draft created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create draft: ${error.message}`);
    },
  });
}

/**
 * Hook for updating a brain document
 */
export function useUpdateBrainDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      contentJson,
      changeSummary,
    }: {
      documentId: string;
      contentJson: BrainDocumentContent;
      changeSummary?: string;
    }) => {
      // Get current document
      const { data: current, error: fetchError } = await supabase
        .from("brain_documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (fetchError) throw fetchError;
      if (!current) throw new Error("Document not found");
      if (current.status === "approved") {
        throw new Error("Cannot edit approved document directly");
      }

      const newVersion = (current.version || 1) + 1;

      // Update document
      const { data, error } = await supabase
        .from("brain_documents")
        .update({
          content_json: contentJson,
          version: newVersion,
        })
        .eq("id", documentId)
        .select()
        .single();

      if (error) throw error;

      // Create version record
      await supabase.from("brain_document_versions").insert({
        document_id: documentId,
        version: newVersion,
        content_json: contentJson,
        change_summary: changeSummary ?? "Content updated",
      });

      return data as BrainDocument;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      queryClient.invalidateQueries({ queryKey: ["brain-document"] });
      queryClient.invalidateQueries({ queryKey: ["brain-document-history", data.id] });
      toast.success("Document updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update document: ${error.message}`);
    },
  });
}

/**
 * Hook for approving a brain document
 */
export function useApproveBrainDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke("ai-brain-document-approve", {
        body: { document_id: documentId },
      });

      if (error) throw error;
      if (!data?.document) throw new Error("Document approval failed");
      return data.document as BrainDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      queryClient.invalidateQueries({ queryKey: ["brain-document"] });
      toast.success("Document approved and active");
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve document: ${error.message}`);
    },
  });
}

/**
 * Hook for archiving a brain document
 */
export function useArchiveBrainDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase
        .from("brain_documents")
        .update({ status: "archived" })
        .eq("id", documentId)
        .select()
        .single();

      if (error) throw error;
      return data as BrainDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-documents"] });
      queryClient.invalidateQueries({ queryKey: ["brain-document"] });
      toast.success("Document archived");
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive document: ${error.message}`);
    },
  });
}

/**
 * Get documents organized by module
 */
export function useDocumentsByModule() {
  const { data: documents = [], ...rest } = useBrainDocuments();

  const byModule = documents.reduce(
    (acc, doc) => {
      if (!acc[doc.module]) {
        acc[doc.module] = [];
      }
      acc[doc.module].push(doc);
      return acc;
    },
    {} as Record<BrainModule, BrainDocument[]>
  );

  // For each module, get the "effective" document (approved > pending > draft)
  const effectiveByModule = Object.entries(byModule).reduce(
    (acc, [module, docs]) => {
      const sorted = [...docs].sort((a, b) => {
        const statusOrder = { approved: 1, pending_approval: 2, draft: 3, archived: 4 } as const;
        const statusDiff = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
        if (statusDiff !== 0) return statusDiff;

        // For documents with the same status, prefer the most recently updated.
        const aTime = Date.parse(a.updated_at ?? a.created_at ?? "");
        const bTime = Date.parse(b.updated_at ?? b.created_at ?? "");
        return bTime - aTime;
      });
      acc[module as BrainModule] = sorted[0] || null;
      return acc;
    },
    {} as Record<BrainModule, BrainDocument | null>
  );

  return { byModule, effectiveByModule, documents, ...rest };
}
