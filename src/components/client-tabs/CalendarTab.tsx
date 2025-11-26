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

interface ScheduledItem {
  id: string;
  title: string;
  scheduled_time: string | null;
  pipeline_stage: string;
  type: 'project' | 'asset';
}

const stageColors: Record<string, string> = {
  approved: "bg-yellow-500",
  scheduled: "bg-blue-500",
  published: "bg-green-500",
};

export default function CalendarTab({ clientId }: CalendarTabProps) {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    fetchScheduledItems();
  }, [clientId]);

  const fetchScheduledItems = async () => {
    try {
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, title, scheduled_time, pipeline_stage")
        .eq("client_id", clientId)
        .in("pipeline_stage", ["scheduled", "published"])
        .not("scheduled_time", "is", null);

      if (projectsError) throw projectsError;

      const scheduledItems: ScheduledItem[] = (projects || []).map(p => ({
        id: p.id,
        title: p.title,
        scheduled_time: p.scheduled_time,
        pipeline_stage: p.pipeline_stage,
        type: 'project' as const,
      }));

      setItems(scheduledItems);
    } catch (error: any) {
      toast({
        title: "Error loading calendar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const getItemsForDay = (day: Date) => {
    return items.filter((item) => {
      if (!item.scheduled_time) return false;
      return isSameDay(parseISO(item.scheduled_time), day);
    });
  };

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
              const dayItems = getItemsForDay(day);
              return (
                <Card key={day.toISOString()} className="p-4">
                  <div className="font-semibold mb-2">
                    {format(day, "EEE")}
                    <br />
                    <span className="text-2xl">{format(day, "d")}</span>
                  </div>
                  <div className="space-y-2">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded border bg-card"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">
                            {item.scheduled_time
                              ? format(parseISO(item.scheduled_time), "HH:mm")
                              : "Unscheduled"}
                          </span>
                        </div>
                        <p className="text-xs font-medium line-clamp-2">
                          {item.title}
                        </p>
                        <Badge
                          className={`${stageColors[item.pipeline_stage]} text-white text-xs mt-1`}
                        >
                          {item.pipeline_stage}
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
              const dayItems = getItemsForDay(day);
              return (
                <Card key={day.toISOString()} className="p-2 min-h-[100px]">
                  <div className="text-sm font-semibold mb-1">
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        className={`${
                          stageColors[item.pipeline_stage]
                        } text-white text-xs p-1 rounded`}
                      >
                        <p className="line-clamp-1">{item.title}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
