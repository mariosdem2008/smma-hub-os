import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash } from "lucide-react";

interface HashtagsTabProps {
  clientId: string;
}

export default function HashtagsTab({ clientId }: HashtagsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Hashtag Library
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Hash className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Hashtag library coming soon
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
