import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PipelineStageColumnProps {
  title: string;
  count: number;
  color: string;
  children: ReactNode;
}

export default function PipelineStageColumn({ 
  title, 
  count, 
  color,
  children 
}: PipelineStageColumnProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
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
      <CardContent className="flex-1 overflow-y-auto space-y-3">
        {children}
      </CardContent>
    </Card>
  );
}
