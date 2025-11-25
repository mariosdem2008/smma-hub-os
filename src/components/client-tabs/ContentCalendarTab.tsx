import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";

interface Asset {
  id: string;
  filename: string;
  platforms: string[] | null;
  scheduled_time: string | null;
  pipeline_stage: string | null;
  final_caption: string | null;
}

interface ContentCalendarTabProps {
  clientId: string;
}

const stageColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "default",
  published: "secondary",
  final: "outline",
};

const platformColors: Record<string, string> = {
  Instagram: "bg-pink-500",
  Facebook: "bg-blue-600",
  TikTok: "bg-black",
  LinkedIn: "bg-blue-700",
  YouTube: "bg-red-600",
};

export default function ContentCalendarTab({ clientId }: ContentCalendarTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssets();
  }, [clientId]);

  const fetchAssets = async () => {
    const { data } = await supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .in("pipeline_stage", ["scheduled", "published"])
      .order("scheduled_time", { ascending: true });

    setAssets(data || []);
    setLoading(false);
  };

  if (loading) {
    return <div>Loading calendar...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Content Calendar</h2>
        <p className="text-muted-foreground">
          View all scheduled and published content
        </p>
      </div>

      {assets.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {asset.scheduled_time
                        ? format(new Date(asset.scheduled_time), "MMM dd, yyyy HH:mm")
                        : "Not scheduled"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{asset.filename}</p>
                      {asset.final_caption && (
                        <p className="text-sm text-muted-foreground truncate max-w-md">
                          {asset.final_caption}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {asset.platforms?.map((platform) => (
                        <Badge
                          key={platform}
                          variant="outline"
                          className={platformColors[platform] || ""}
                        >
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stageColors[asset.pipeline_stage || ""] || "outline"}>
                      {asset.pipeline_stage}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <div className="p-12 text-center">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled content</h3>
            <p className="text-muted-foreground">
              Content will appear here once it's been scheduled
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
