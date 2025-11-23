import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface IdeasTabProps {
  clientId: string;
}

export default function IdeasTab({ clientId }: IdeasTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Content Ideas Bank
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Ideas management coming soon
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
