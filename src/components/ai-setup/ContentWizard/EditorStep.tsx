import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownPreview } from "@/components/ai-setup/MarkdownPreview";
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Saving creates a draft. You can activate it from the module page.
        </div>
        <div className="text-xs text-muted-foreground">Markdown supported</div>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            className="min-h-[360px] font-mono text-sm"
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-3">
          <div className="min-h-[360px] rounded-md border border-border/60 bg-card/40 p-4">
            {content.trim() ? (
              <div className="max-h-[360px] overflow-y-auto pr-2">
                <MarkdownPreview content={content} />
              </div>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">
                Start typing to see a preview.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

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
