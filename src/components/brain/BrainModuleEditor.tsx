import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { BrainModule } from "@/lib/ai/brainModules";
import type { BrainDocument } from "@/lib/ai/brainDocuments";
import { BRAIN_MODULE_LABELS } from "@/lib/ai/brainModules";
import {
  useCreateBrainDocumentDraft,
  useUpdateBrainDocument,
} from "@/hooks/useBrainDocuments";
import {
  BootstrapProfileEditor,
  RepPolicyEditor,
  ToneVoiceEditor,
  OfferStackEditor,
  QualityBarEditor,
  GenericEditor,
} from "./editors";

interface BrainModuleEditorProps {
  module: BrainModule;
  document: BrainDocument | null;
  onClose: () => void;
}

export function BrainModuleEditor({ module, document, onClose }: BrainModuleEditorProps) {
  const [changeSummary, setChangeSummary] = useState("");

  const createDraft = useCreateBrainDocumentDraft();
  const updateDocument = useUpdateBrainDocument();

  const isSaving = createDraft.isPending || updateDocument.isPending;

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      if (document) {
        await updateDocument.mutateAsync({
          documentId: document.id,
          contentJson: data,
          changeSummary: changeSummary || undefined,
        });
      } else {
        await createDraft.mutateAsync({
          module,
          title: BRAIN_MODULE_LABELS[module],
          contentJson: data,
          source: "manual",
        });
      }
      toast.success(document ? "Changes saved" : "Draft created");
      onClose();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  // Render the appropriate editor based on module type
  const renderEditor = () => {
    const editorProps = {
      document,
      onSave: handleSave,
      onClose,
      isSaving,
    };

    switch (module) {
      case "bootstrap":
        return <BootstrapProfileEditor {...editorProps} />;
      case "rep_policy":
        return <RepPolicyEditor {...editorProps} />;
      case "tone_voice":
        return <ToneVoiceEditor {...editorProps} />;
      case "offer_stack":
        return <OfferStackEditor {...editorProps} />;
      case "quality_bar":
        return <QualityBarEditor {...editorProps} />;
      default:
        return (
          <GenericEditor
            module={module}
            document={document}
            onSave={handleSave}
            onClose={onClose}
            isSaving={isSaving}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Change summary input for context */}
      <div className="space-y-2">
        <Label htmlFor="changeSummary">Change Summary (optional)</Label>
        <Input
          id="changeSummary"
          placeholder="Briefly describe your changes..."
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
        />
      </div>

      <Separator />

      {/* Render the module-specific editor */}
      {renderEditor()}
    </div>
  );
}
