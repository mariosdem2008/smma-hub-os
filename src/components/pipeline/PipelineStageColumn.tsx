import { ReactNode } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PipelineStageColumnProps {
  stageId: string;
  title: string;
  count: number;
  color: string;
  children: ReactNode;
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  idea: "Initial content concepts and brainstorming",
  in_production: "Content is being actively created and edited",
  review: "Ready for client review and approval",
  approved: "Client approved, ready for scheduling",
  scheduled: "Set to publish at a specific date/time",
  published: "Live on social media platforms",
};

export default function PipelineStageColumn({ 
  stageId,
  title, 
  count, 
  color,
  children 
}: PipelineStageColumnProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{STAGE_DESCRIPTIONS[stageId]}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge 
            variant="secondary" 
            className="text-xs"
            style={{ 
              backgroundColor: `hsl(${color} / 0.1)`,
              color: `hsl(${color})`
            }}
          >
            {count}
          </Badge>
        </div>
      </CardHeader>
      <Droppable droppableId={stageId}>
        {(provided, snapshot) => (
          <CardContent 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto space-y-3 transition-colors ${
              snapshot.isDraggingOver ? 'bg-primary/5 border-2 border-dashed border-primary' : ''
            }`}
          >
            {children}
            {provided.placeholder}
          </CardContent>
        )}
      </Droppable>
    </Card>
  );
}
