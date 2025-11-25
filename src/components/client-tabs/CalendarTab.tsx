import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, parseISO } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CalendarTabProps {
  clientId: string;
}

interface Asset {
  id: string;
  filename: string;
  platforms: string[] | null;
  scheduled_time: string | null;
  pipeline_stage: string;
  final_caption: string | null;
  file_url: string;
  file_type: string;
}

const stageColors: Record<string, string> = {
  approved: "bg-yellow-500",
  scheduled: "bg-blue-500",
  published: "bg-green-500",
};

export default function CalendarTab({ clientId }: CalendarTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    fetchAssets();
  }, [clientId]);

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .in("pipeline_stage", ["approved", "scheduled", "published"])
      .order("scheduled_time", { ascending: true, nullsFirst: false });

    if (error) {
      toast({
        title: "Error loading calendar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAssets(data || []);
    }
    setLoading(false);
  };

  const handleDateChange = async (assetId: string, newDate: Date) => {
    const { error } = await supabase
      .from("assets")
      .update({ scheduled_time: newDate.toISOString() })
      .eq("id", assetId);

    if (error) {
      toast({
        title: "Error updating schedule",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Schedule updated",
        description: "Asset rescheduled successfully",
      });
      fetchAssets();
    }
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const getMonthDays = () => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    return eachDayOfInterval({ start, end });
  };

  const getAssetsForDay = (day: Date) => {
    return assets.filter((asset) => {
      if (!asset.scheduled_time) return false;
      return isSameDay(parseISO(asset.scheduled_time), day);
    });
  };

  const unscheduledAssets = assets.filter(
    (a) => a.pipeline_stage === "approved" && !a.scheduled_time
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Calendar</h2>
          <p className="text-muted-foreground">
            Manage your scheduled and published content
          </p>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "week" | "month")}>
        <TabsList>
          <TabsTrigger value="week">Week View</TabsTrigger>
          <TabsTrigger value="month">Month View</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "MMM d")} -{" "}
              {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "MMM d, yyyy")}
            </h3>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </div>

          <div className="grid grid-cols-7 gap-4">
            {getWeekDays().map((day) => {
              const dayAssets = getAssetsForDay(day);
              return (
                <Card key={day.toISOString()} className="p-4">
                  <div className="font-semibold mb-2">
                    {format(day, "EEE")}
                    <br />
                    <span className="text-2xl">{format(day, "d")}</span>
                  </div>
                  <div className="space-y-2">
                    {dayAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="p-2 rounded border bg-card cursor-move"
                        draggable
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">
                            {asset.scheduled_time
                              ? format(parseISO(asset.scheduled_time), "HH:mm")
                              : "Unscheduled"}
                          </span>
                        </div>
                        <p className="text-xs font-medium line-clamp-2">
                          {asset.filename}
                        </p>
                        <Badge
                          className={`${stageColors[asset.pipeline_stage]} text-white text-xs mt-1`}
                        >
                          {asset.pipeline_stage}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="month" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {format(selectedDate, "MMMM yyyy")}
            </h3>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="font-semibold text-center text-sm p-2">
                {day}
              </div>
            ))}
            {getMonthDays().map((day) => {
              const dayAssets = getAssetsForDay(day);
              return (
                <Card key={day.toISOString()} className="p-2 min-h-[100px]">
                  <div className="text-sm font-semibold mb-1">
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className={`${
                          stageColors[asset.pipeline_stage]
                        } text-white text-xs p-1 rounded`}
                      >
                        <p className="line-clamp-1">{asset.filename}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {unscheduledAssets.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Approved (Unscheduled)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {unscheduledAssets.map((asset) => (
              <div key={asset.id} className="p-3 border rounded bg-card">
                {asset.file_type.startsWith("image/") && (
                  <img
                    src={asset.file_url}
                    alt={asset.filename}
                    className="w-full h-32 object-cover rounded mb-2"
                  />
                )}
                <p className="text-sm font-medium line-clamp-2 mb-2">
                  {asset.filename}
                </p>
                <Badge variant="outline" className="text-xs">
                  {asset.pipeline_stage}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
