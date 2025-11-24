import { useOutletContext } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Image, FileIcon } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface Deliverable {
  id: string;
  type: "post" | "asset" | "strategy_doc";
  title: string;
  status: string;
  date: string;
  thumbnail?: string;
  file_url?: string;
}

export default function PortalDeliverables() {
  const { clientId } = useOutletContext<{ clientId: string }>();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchDeliverables();
  }, [clientId, typeFilter, dateFilter, customDate]);

  const fetchDeliverables = async () => {
    setLoading(true);
    try {
      let allDeliverables: Deliverable[] = [];

      // Fetch approved and scheduled posts
      if (typeFilter === "all" || typeFilter === "post") {
        const { data: posts } = await supabase
          .from("posts")
          .select("id, title, status, scheduled_for, created_at")
          .eq("client_id", clientId)
          .in("status", ["approved", "scheduled"]);

        if (posts) {
          allDeliverables.push(
            ...posts.map((post) => ({
              id: post.id,
              type: "post" as const,
              title: post.title,
              status: post.status || "draft",
              date: post.scheduled_for || post.created_at,
            }))
          );
        }
      }

      // Fetch brand assets
      if (typeFilter === "all" || typeFilter === "asset") {
        const { data: assets } = await supabase
          .from("assets")
          .select("id, filename, file_url, file_type, created_at, status")
          .eq("client_id", clientId)
          .eq("visible_to_client", true);

        if (assets) {
          allDeliverables.push(
            ...assets.map((asset) => ({
              id: asset.id,
              type: "asset" as const,
              title: asset.filename,
              status: asset.status || "approved",
              date: asset.created_at,
              thumbnail: asset.file_url,
              file_url: asset.file_url,
            }))
          );
        }
      }

      // Fetch strategy documents (PDFs from client_assets)
      if (typeFilter === "all" || typeFilter === "strategy_doc") {
        const { data: docs } = await supabase
          .from("client_assets")
          .select("id, file_name, file_url, created_at")
          .eq("client_id", clientId)
          .like("file_type", "%pdf%");

        if (docs) {
          allDeliverables.push(
            ...docs.map((doc) => ({
              id: doc.id,
              type: "strategy_doc" as const,
              title: doc.file_name || "Strategy Document",
              status: "delivered",
              date: doc.created_at,
              file_url: doc.file_url,
            }))
          );
        }
      }

      // Apply date filter
      const filtered = applyDateFilter(allDeliverables);
      
      // Sort by date descending
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setDeliverables(filtered);
    } catch (error) {
      console.error("Error fetching deliverables:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyDateFilter = (items: Deliverable[]) => {
    if (dateFilter === "all") return items;

    const now = new Date();
    let start: Date, end: Date;

    if (dateFilter === "week") {
      start = startOfWeek(now);
      end = endOfWeek(now);
    } else if (dateFilter === "month") {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (dateFilter === "custom" && customDate) {
      start = new Date(customDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(customDate);
      end.setHours(23, 59, 59, 999);
    } else {
      return items;
    }

    return items.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= start && itemDate <= end;
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "post":
        return <FileText className="h-4 w-4" />;
      case "asset":
        return <Image className="h-4 w-4" />;
      case "strategy_doc":
        return <FileIcon className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      post: "default",
      asset: "secondary",
      strategy_doc: "outline",
    };
    return variants[type] || "default";
  };

  const handleView = (deliverable: Deliverable) => {
    if (deliverable.file_url) {
      window.open(deliverable.file_url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Deliverables</h1>
        <p className="text-muted-foreground mt-1">
          View all approved content and assets
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="post">Posts</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="strategy_doc">Strategy Docs</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Date</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-48 justify-start text-left font-normal",
                      !customDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate ? format(customDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={setCustomDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading deliverables...
            </div>
          ) : deliverables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deliverables found
            </div>
          ) : (
            <div className="space-y-4">
              {deliverables.map((item) => (
                <Card key={item.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                            {getTypeIcon(item.type)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold truncate">{item.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={getTypeBadge(item.type)}>
                                {item.type.replace("_", " ")}
                              </Badge>
                              <Badge variant="outline">{item.status}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(item.date), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleView(item)}
                            disabled={!item.file_url}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
