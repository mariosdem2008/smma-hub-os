import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { Globe, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { convertToLocal } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import ScheduledPostDetailModal from "@/components/pipeline/ScheduledPostDetailModal";
import ClientTabEmptyState from "./shared/ClientTabEmptyState";
import { AIAssistant } from "@/components/pipeline/AIAssistant";
import { useNavigate } from "react-router-dom";

interface CalendarTabProps {
  clientId: string;
}

interface ScheduledItem {
  id: string;
  project_id: string;
  title: string;
  platform: string;
  scheduled_for: string;
  status: string;
  error_message: string | null;
  caption: string | null;
  platform_post_id: string | null;
  platform_permalink: string | null;
}

const stageColors: Record<string, string> = {
  pending: "bg-yellow-500",
  queued: "bg-blue-400",
  publishing: "bg-blue-600",
  published: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  queued: "Queued",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function CalendarTab({ clientId }: CalendarTabProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month" | "queue">("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>("UTC");
  const { toast } = useToast();

  useEffect(() => {
    fetchUserTimezone();
    fetchScheduledItems();
  }, [clientId]);

  const fetchUserTimezone = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      if (data?.timezone) {
        setUserTimezone(data.timezone);
      }
    } catch (error) {
      console.error("Error fetching timezone:", error);
    }
  };

  const fetchScheduledItems = async () => {
    try {
      // Fetch scheduled posts
      const { data: scheduledPosts, error: postsError } = await supabase
        .from("scheduled_posts")
        .select(`
          id,
          project_id,
          platform,
          scheduled_for,
          status,
          error_message,
          caption,
          platform_post_id,
          platform_permalink,
          projects(title)
        `)
        .eq("client_id", clientId)
        .order("scheduled_for", { ascending: true });

      if (postsError) throw postsError;

      const scheduledItems: ScheduledItem[] = (scheduledPosts || []).map(p => ({
        id: p.id,
        project_id: p.project_id,
        title: (p.projects as any)?.title || "Untitled",
        platform: p.platform,
        scheduled_for: p.scheduled_for,
        status: p.status,
        error_message: p.error_message,
        caption: p.caption,
        platform_post_id: p.platform_post_id,
        platform_permalink: p.platform_permalink,
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
      if (!item.scheduled_for) return false;
      // Convert UTC time to local time for comparison
      const localDate = convertToLocal(item.scheduled_for, userTimezone);
      return isSameDay(localDate, day);
    });
  };

  const formatLocalTime = (utcString: string, timezone: string) => {
    const localDate = convertToLocal(utcString, timezone);
    return format(localDate, "HH:mm");
  };

  const formatLocalDateTime = (utcString: string, timezone: string) => {
    const localDate = convertToLocal(utcString, timezone);
    return format(localDate, "MMM d, yyyy 'at' h:mm a");
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram":
        return "📷";
      case "facebook":
        return "📘";
      case "linkedin":
        return "💼";
      default:
        return "🌐";
    }
  };

  const handleOpenDetail = (postId: string) => {
    setSelectedPostId(postId);
    setDetailModalOpen(true);
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
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Content Calendar</h2>
            <Badge variant="outline" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              {userTimezone}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Manage your scheduled and published content
          </p>
        </div>
        <AIAssistant
          projectId=""
          clientId={clientId}
          onGenerateIdea={() => {
            toast({
              title: "Idea generated",
              description: "Use it in Ideas or Pipeline for execution.",
            });
          }}
          onGenerateHook={() => {
            toast({
              title: "Hooks generated",
              description: "Review and use in script workflows.",
            });
          }}
          onGenerateScript={() => {
            toast({
              title: "Script generated",
              description: "Open Idea/Scripting to apply the draft.",
            });
          }}
          onImproveScript={() => {
            toast({
              title: "Script improvements generated",
              description: "Open Idea/Scripting to apply updates.",
            });
          }}
          onGenerateCaption={() => {
            toast({
              title: "Captions generated",
              description: "Use results for scheduled posts in Calendar.",
            });
          }}
          onImproveCaption={() => {
            toast({
              title: "Caption improvements generated",
              description: "Apply refined copy before publish.",
            });
          }}
        />
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-muted-foreground font-medium">Status:</span>
        {Object.entries(stageColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-muted-foreground">{statusLabels[status]}</span>
          </div>
        ))}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "week" | "month" | "queue")}>
        <TabsList>
          <TabsTrigger value="week">Week View</TabsTrigger>
          <TabsTrigger value="month">Month View</TabsTrigger>
          <TabsTrigger value="queue">Publishing Queue</TabsTrigger>
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
                <Card 
                  key={day.toISOString()} 
                  className="p-4"
                >
                  <div className="font-semibold mb-2">
                    {format(day, "EEE")}
                    <br />
                    <span className="text-2xl">{format(day, "d")}</span>
                  </div>
                  <div className="space-y-2">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleOpenDetail(item.id)}
                        className="p-2 rounded border bg-card hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex flex-col gap-0.5 mb-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs mr-1">{getPlatformIcon(item.platform)}</span>
                            <Clock className="h-3 w-3" />
                            <span className="text-xs font-medium">
                              {item.scheduled_for
                                ? formatLocalTime(item.scheduled_for, userTimezone)
                                : "Unscheduled"}
                            </span>
                            {item.scheduled_for && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-3.5">
                                {userTimezone}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs font-medium line-clamp-2">
                          {item.title}
                        </p>
                        <Badge
                          className={`${stageColors[item.status]} text-white text-xs mt-1`}
                        >
                          {item.status}
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
                <Card 
                  key={day.toISOString()} 
                  className="p-2 min-h-[100px]"
                >
                  <div className="text-sm font-semibold mb-1">
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleOpenDetail(item.id)}
                        className={`${
                          stageColors[item.status]
                        } text-white text-xs p-1 rounded hover:opacity-80 cursor-pointer transition-opacity`}
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

        <TabsContent value="queue" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Publishing Queue</h3>
            <p className="text-sm text-muted-foreground">
              {items.length} posts scheduled
            </p>
          </div>

          <div className="space-y-3">
            {items.length === 0 ? (
              <ClientTabEmptyState
                icon={<Clock className="h-12 w-12" />}
                title="No scheduled posts yet"
                description="Create content in the Pipeline and schedule it to see posts here."
                primaryAction={{
                  label: "Go to Pipeline",
                  onClick: () => navigate(`/clients/${clientId}?tab=pipeline`),
                }}
              />
            ) : (
              items
                .filter((item) => item.scheduled_for)
                .map((item) => (
                  <Card
                    key={item.id}
                    onClick={() => handleOpenDetail(item.id)}
                    className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{getPlatformIcon(item.platform)}</span>
                          <div className="flex-1">
                            <h4 className="font-semibold">{item.title}</h4>
                            <p className="text-sm text-muted-foreground capitalize">
                              {item.platform}
                            </p>
                          </div>
                          <Badge className={`${stageColors[item.status]} text-white`}>
                            {item.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">
                              {item.scheduled_for
                                ? formatLocalDateTime(item.scheduled_for, userTimezone)
                                : "Unscheduled"}
                            </span>
                            {item.scheduled_for && (
                              <Badge variant="outline" className="text-xs">
                                <Globe className="h-3 w-3 mr-1" />
                                {userTimezone}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {item.error_message && (
                          <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800 mt-2">
                            <p className="text-xs text-red-900 dark:text-red-100">
                              {item.error_message}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <ScheduledPostDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        scheduledPostId={selectedPostId}
        userTimezone={userTimezone}
        onSuccess={fetchScheduledItems}
        readOnly={false}
      />
    </div>
  );
}
