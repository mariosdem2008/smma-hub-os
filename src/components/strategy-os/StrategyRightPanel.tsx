import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DecisionsTab } from "./right-rail/DecisionsTab";
import { HistoryTab } from "./right-rail/HistoryTab";
import { TasksTab } from "./right-rail/TasksTab";

type StrategyRightPanelTab = "decisions" | "history" | "tasks";

interface StrategyRightPanelProps {
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tabLabels: Record<StrategyRightPanelTab, string> = {
  decisions: "Decisions",
  history: "History",
  tasks: "Tasks",
};

function PanelBody() {
  const [activeTab, setActiveTab] = useState<StrategyRightPanelTab>("decisions");

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as StrategyRightPanelTab)}>
      <TabsList className="grid w-full grid-cols-3">
        {Object.entries(tabLabels).map(([key, label]) => (
          <TabsTrigger key={key} value={key}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="decisions" className="mt-4 h-[calc(100vh-220px)] overflow-hidden rounded-lg border border-border/60 bg-background/40">
        <DecisionsTab />
      </TabsContent>
      <TabsContent value="history" className="mt-4 h-[calc(100vh-220px)] overflow-hidden rounded-lg border border-border/60 bg-background/40">
        <HistoryTab />
      </TabsContent>
      <TabsContent value="tasks" className="mt-4 h-[calc(100vh-220px)] overflow-hidden rounded-lg border border-border/60 bg-background/40">
        <TasksTab />
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
            <SheetTitle>AI Assistant</SheetTitle>
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
        <div className="text-sm font-semibold">AI Assistant</div>
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          Hide
        </Button>
      </div>
      <PanelBody />
    </aside>
  );
}

export default StrategyRightPanel;
