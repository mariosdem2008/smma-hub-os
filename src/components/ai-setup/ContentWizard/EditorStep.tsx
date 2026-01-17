import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBrainDocumentUpload } from "@/hooks/useBrainDocumentUpload";
import type { BrainModule } from "@/lib/ai/brainModules";
import { getExampleContent } from "@/lib/brain/examples";
import { toast } from "sonner";
import { MODULE_CONFIG } from "@/lib/brain/moduleConfig";
import { useAgencyData } from "@/hooks/useAgencyData";
import { renderTemplate } from "@/brain/defaultPackV1";

export function EditorStep({
  module,
  method,
  onDone,
}: {
  module: BrainModule;
  method: "template" | "write";
  onDone: () => void;
}) {
  const { uploadAndAnalyze, isUploading } = useBrainDocumentUpload();
  const [content, setContent] = useState("");
  const { agency } = useAgencyData();

  const moduleName = MODULE_CONFIG[module]?.name ?? "this module";

  useEffect(() => {
    if (method === "template") {
      const example = getExampleContent(module);
      const fields = {
        agency_name: agency?.name ?? "[Your Agency Name]",
        agency_website: agency?.website ?? "[Your Website]",
        agency_niche: agency?.niche ?? "[Your Niche]",
      };
      setContent(renderTemplate(example, fields));
    } else {
      setContent("");
    }
  }, [agency?.name, agency?.niche, agency?.website, method, module]);

  const placeholder = useMemo(() => {
    return `Write notes for ${moduleName} here...`;
  }, [moduleName]);

  const onSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Add some content to continue");
      return;
    }

    try {
      const file = new File([trimmed], `${module}.md`, { type: "text/markdown" });
      await uploadAndAnalyze({ file, module, mode: "transformed" });
      toast.success("Draft saved");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save draft");
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Saving creates a draft. You can activate it from the module page.
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="min-h-[360px] font-mono text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={isUploading}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={isUploading}>
          Save Draft →
        </Button>
      </div>
    </div>
  );
}
