import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface SavedCaptionsTabProps {
  clientId: string;
}

export default function SavedCaptionsTab({ clientId }: SavedCaptionsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Saved Captions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Saved captions coming soon
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
