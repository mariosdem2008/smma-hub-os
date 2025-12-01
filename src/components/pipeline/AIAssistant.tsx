import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Lightbulb, FileText, PenTool, MessageSquare, RefreshCw } from "lucide-react";
import { AIGenerateModal } from "./AIGenerateModal";

interface AIAssistantProps {
  projectId: string;
  clientId: string;
  onGenerateIdea: (idea: any) => void;
  onGenerateHook: (hook: string) => void;
  onGenerateScript: (script: string) => void;
  onImproveScript: (script: string) => void;
  onGenerateCaption: (captions: Record<string, string>) => void;
  onImproveCaption: (captions: Record<string, string>) => void;
}

export function AIAssistant({
  projectId,
  clientId,
  onGenerateIdea,
  onGenerateHook,
  onGenerateScript,
  onImproveScript,
  onGenerateCaption,
  onImproveCaption,
}: AIAssistantProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const aiActions = [
    {
      id: "ideas",
      label: "Generate Ideas",
      icon: Lightbulb,
      description: "Get content ideas based on niche and trends",
      color: "text-yellow-500",
    },
    {
      id: "hooks",
      label: "Generate Hooks",
      icon: PenTool,
      description: "Create attention-grabbing opening hooks",
      color: "text-purple-500",
    },
    {
      id: "script",
      label: "Write Script",
      icon: FileText,
      description: "Generate complete video scripts",
      color: "text-blue-500",
    },
    {
      id: "improve-script",
      label: "Improve Script",
      icon: RefreshCw,
      description: "Enhance existing script content",
      color: "text-green-500",
    },
    {
      id: "captions",
      label: "Generate Captions",
      icon: MessageSquare,
      description: "Create platform-specific captions",
      color: "text-pink-500",
    },
    {
      id: "improve-caption",
      label: "Improve Captions",
      icon: RefreshCw,
      description: "Enhance existing caption text",
      color: "text-orange-500",
    },
  ];

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Assist
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Content Assistant
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {aiActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                className="w-full justify-start h-auto py-4 px-4 hover:bg-accent"
                onClick={() => setActiveModal(action.id)}
              >
                <div className="flex items-start gap-3 text-left w-full">
                  <action.icon className={`h-5 w-5 mt-0.5 ${action.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{action.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {action.description}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* AI Generation Modals */}
      <AIGenerateModal
        open={activeModal === "ideas"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        type="ideas"
        clientId={clientId}
        onUse={onGenerateIdea}
      />
      <AIGenerateModal
        open={activeModal === "hooks"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        type="hooks"
        clientId={clientId}
        onUse={onGenerateHook}
      />
      <AIGenerateModal
        open={activeModal === "script"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        type="script"
        clientId={clientId}
        onUse={onGenerateScript}
      />
      <AIGenerateModal
        open={activeModal === "improve-script"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        type="improve-script"
        clientId={clientId}
        onUse={onImproveScript}
      />
      <AIGenerateModal
        open={activeModal === "captions"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        type="captions"
        clientId={clientId}
        onUse={onGenerateCaption}
      />
      <AIGenerateModal
        open={activeModal === "improve-caption"}
        onOpenChange={(open) => !open && setActiveModal(null)}
        type="improve-caption"
        clientId={clientId}
        onUse={onImproveCaption}
      />
    </>
  );
}
