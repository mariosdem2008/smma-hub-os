import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type StrategyRightPanelTab = "ai" | "decisions" | "history" | "tasks";

interface StrategyRightPanelProps {
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tabLabels: Record<StrategyRightPanelTab, string> = {
  ai: "AI",
  decisions: "Decisions",
  history: "History",
  tasks: "Tasks",
};

function PanelBody() {
  const [activeTab, setActiveTab] = useState<StrategyRightPanelTab>("ai");

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as StrategyRightPanelTab)}>
      <TabsList className="grid w-full grid-cols-4">
        {Object.entries(tabLabels).map(([key, label]) => (
          <TabsTrigger key={key} value={key}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="ai" className="mt-4 space-y-2 text-sm">
        <div className="font-semibold">AI assistant coming soon</div>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>Ask for positioning drafts</li>
          <li>Generate pillar ideas</li>
          <li>Suggest weekly execution steps</li>
        </ul>
      </TabsContent>
      <TabsContent value="decisions" className="mt-4 text-sm text-muted-foreground">
        No decisions yet.
      </TabsContent>
      <TabsContent value="history" className="mt-4 text-sm text-muted-foreground">
        No history yet.
      </TabsContent>
      <TabsContent value="tasks" className="mt-4 text-sm text-muted-foreground">
        No tasks yet.
      </TabsContent>
    </Tabs>
  );
}

export function StrategyRightPanel({ isMobile, open, onOpenChange }: StrategyRightPanelProps) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Panel</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PanelBody />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="rounded-lg border border-border/60 bg-background/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Panel</div>
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          Hide
        </Button>
      </div>
      <PanelBody />
    </aside>
  );
}

export default StrategyRightPanel;

