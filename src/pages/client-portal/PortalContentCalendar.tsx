import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
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

interface OutletContext {
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

export function PortalContentCalendar() {
  const { clientId } = useOutletContext<OutletContext>();
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
    return <div>Loading content calendar...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Content Calendar</h1>
        <p className="text-muted-foreground">
          View all your scheduled content and campaigns
        </p>
      </div>

      {assets.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {asset.scheduled_time
                          ? format(new Date(asset.scheduled_time), "MMM d, yyyy")
                          : "Not scheduled"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{asset.filename}</p>
                      {asset.final_caption && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {asset.final_caption}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {asset.platforms?.map((platform) => (
                        <Badge
                          key={platform}
                          variant="outline"
                          className={`${
                            platformColors[platform] || "bg-gray-500"
                          } text-white border-0 text-xs`}
                        >
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stageColors[asset.pipeline_stage || "scheduled"]}>
                      {asset.pipeline_stage || "scheduled"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Scheduled Posts</h3>
          <p className="text-muted-foreground">
            Your agency hasn't scheduled any content yet. Check back soon!
          </p>
        </Card>
      )}
    </div>
  );
}
