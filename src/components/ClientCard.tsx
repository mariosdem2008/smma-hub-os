import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Video, Eye, Heart } from "lucide-react";
import { useClientMetricsSummary } from "@/hooks/useClientMetricsSummary";

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    company: string | null;
    logo_url: string | null;
    assetCount: number;
    publishedVideoCount: number;
  };
  onClick: () => void;
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  const { data: metrics, isLoading } = useClientMetricsSummary(client.id);

  return (
    <Card
      className="overflow-hidden hover:border-primary/50 transition-all duration-300 cursor-pointer group hover:shadow-lg border"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {client.logo_url ? (
            <img
              src={client.logo_url}
              alt={client.name}
              className="h-12 w-12 rounded-xl object-cover shadow-sm group-hover:shadow-md transition-shadow"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-lg font-bold text-primary group-hover:scale-105 transition-transform">
              {client.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate group-hover:text-primary transition-colors">{client.name}</CardTitle>
            {client.company && <CardDescription className="truncate">{client.company}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-lg">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{client.assetCount} assets</span>
          </div>
          <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-lg">
            <Video className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{client.publishedVideoCount} published</span>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : metrics && metrics.postsPublished > 0 ? (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <div className="bg-gradient-to-br from-primary/5 to-accent/10 rounded-lg p-2 border border-primary/10">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-primary" />
                <p className="text-xs text-muted-foreground">Impressions</p>
              </div>
              <p className="text-sm font-bold mt-1">{metrics.totalImpressions.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-accent-pink/5 to-accent-pink/10 rounded-lg p-2 border border-accent-pink/10">
              <div className="flex items-center gap-1.5">
                <Heart className="h-3 w-3 text-accent-pink" />
                <p className="text-xs text-muted-foreground">Engagement</p>
              </div>
              <p className="text-sm font-bold mt-1">{metrics.avgEngagementRate}%</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30 rounded-lg">No analytics yet</p>
        )}
      </CardContent>
    </Card>
  );
}
