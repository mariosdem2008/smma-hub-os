import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Columns3 } from "lucide-react";

interface ContentPillarsTabProps {
  clientId: string;
}

export default function ContentPillarsTab({ clientId }: ContentPillarsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Columns3 className="h-5 w-5" />
          Content Pillars
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Columns3 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Content pillars management coming soon
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
