import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BrainModule } from "@/lib/ai/brainModules";
import { MODULE_CONFIG } from "@/lib/brain/moduleConfig";
import { MethodStep } from "@/components/ai-setup/ContentWizard/MethodStep";
import { EditorStep } from "@/components/ai-setup/ContentWizard/EditorStep";
import { UploadStep } from "@/components/ai-setup/ContentWizard/UploadStep";

type Method = "template" | "upload" | "write";

export function ContentWizard({
  isOpen,
  onClose,
  module,
  initialMethod,
}: {
  isOpen: boolean;
  onClose: () => void;
  module: BrainModule;
  initialMethod?: Method;
}) {
  const [method, setMethod] = useState<Method | null>(initialMethod ?? null);

  useEffect(() => {
    if (!isOpen) return;
    setMethod(initialMethod ?? null);
  }, [isOpen, initialMethod]);

  const title = useMemo(() => {
    const name = MODULE_CONFIG[module]?.name ?? "Module";
    if (!method) return `Set up ${name}`;
    if (method === "template") return `Start with a template`;
    if (method === "upload") return `Upload a document`;
    return `Write content`;
  }, [method, module]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Create or upload content for this AI setup module.</DialogDescription>
        </DialogHeader>

        {!method ? (
          <MethodStep
            onPick={(m) => setMethod(m)}
          />
        ) : method === "upload" ? (
          <UploadStep module={module} onDone={onClose} />
        ) : (
          <EditorStep module={module} method={method} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
