import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { hapticSelection } from "@/lib/haptics";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, parseISO } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  title: string;
  platforms: string[] | null;
  scheduled_time: string | null;
  pipeline_stage: string;
}

interface OutletContext {
  clientId: string;
}

const stageColors: Record<string, string> = {
  approved: "bg-yellow-500",
  scheduled: "bg-blue-500",
  published: "bg-green-500",
};

export function PortalContentCalendar() {
  const { clientId } = useOutletContext<OutletContext>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, platforms, scheduled_time, pipeline_stage")
      .eq("client_id", clientId)
      .in("pipeline_stage", ["scheduled", "published"])
      .not("scheduled_time", "is", null)
      .order("scheduled_time", { ascending: true });

    if (error) {
      toast({
        title: "Error loading calendar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setProjects(data || []);
    }

    setLoading(false);
  };

  // Pull-to-refresh
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchProjects();
    },
  });

  useEffect(() => {
    fetchProjects();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('portal-calendar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

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

  const getProjectsForDay = (day: Date) => {
    return projects.filter((project) => {
      if (!project.scheduled_time) return false;
      return isSameDay(parseISO(project.scheduled_time), day);
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
    <div 
      className="space-y-4 md:space-y-6 p-4 md:p-0"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div className="flex justify-center">
          <div className={`text-sm text-muted-foreground transition-opacity ${pullDistance > 60 ? "opacity-100" : "opacity-50"}`}>
            {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Content Calendar</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            View your scheduled and published content
          </p>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => { setView(v as "week" | "month"); hapticSelection(); }}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="week" className="flex-1 md:flex-none">Week View</TabsTrigger>
          <TabsTrigger value="month" className="flex-1 md:flex-none">Month View</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <h3 className="text-base md:text-lg font-semibold">
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

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2 md:gap-4">
            {getWeekDays().map((day) => {
              const dayProjects = getProjectsForDay(day);
              return (
                <Card key={day.toISOString()} className="p-3 md:p-4">
                  <div className="font-semibold mb-2 text-center md:text-left">
                    <span className="text-sm md:text-base">{format(day, "EEE")}</span>
                    <br />
                    <span className="text-xl md:text-2xl">{format(day, "d")}</span>
                  </div>
                  <div className="space-y-2">
                    {dayProjects.map((project) => (
                      <div
                        key={project.id}
                        className="p-2 rounded border bg-card"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">
                            {project.scheduled_time
                              ? format(parseISO(project.scheduled_time), "HH:mm")
                              : "Unscheduled"}
                          </span>
                        </div>
                        <p className="text-xs font-medium line-clamp-2">
                          {project.title}
                        </p>
                        <Badge
                          className={`${stageColors[project.pipeline_stage]} text-white text-xs mt-1`}
                        >
                          {project.pipeline_stage}
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
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <h3 className="text-base md:text-lg font-semibold">
              {format(selectedDate, "MMMM yyyy")}
            </h3>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="font-semibold text-center text-xs md:text-sm p-1 md:p-2">
                {day}
              </div>
            ))}
            {getMonthDays().map((day) => {
              const dayProjects = getProjectsForDay(day);
              return (
                <Card key={day.toISOString()} className="p-1 md:p-2 min-h-[80px] md:min-h-[100px]">
                  <div className="text-xs md:text-sm font-semibold mb-1">
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayProjects.map((project) => (
                      <div
                        key={project.id}
                        className={`${
                          stageColors[project.pipeline_stage]
                        } text-white text-xs p-1 rounded`}
                      >
                        <p className="line-clamp-1">{project.title}</p>
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
