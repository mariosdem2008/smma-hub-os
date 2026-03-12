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
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { Clock, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHasSupabaseSession } from "@/hooks/useHasSupabaseSession";
import { convertToLocal } from "@/lib/utils";
import ScheduledPostDetailModal from "@/components/pipeline/ScheduledPostDetailModal";

interface ScheduledPost {
  id: string;
  project_id: string;
  title: string;
  platform: string;
  scheduled_for: string;
  status: string;
}

interface OutletContext {
  clientId: string;
  userTimezone?: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  queued: "bg-blue-400",
  publishing: "bg-blue-600",
  published: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
};

export function PortalContentCalendar() {
  const { clientId, userTimezone = "UTC" } = useOutletContext<OutletContext>();
  const { hasSession, loading: sessionLoading } = useHasSupabaseSession();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select(`
        id,
        project_id,
        platform,
        scheduled_for,
        status,
        projects(title)
      `)
      .eq("client_id", clientId)
      .in("status", ["pending", "queued", "publishing", "published"])
      .order("scheduled_for", { ascending: true });

    if (error) {
      toast({
        title: "Error loading calendar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const scheduledPosts: ScheduledPost[] = (data || []).map(p => ({
        id: p.id,
        project_id: p.project_id,
        title: (p.projects as any)?.title || "Untitled",
        platform: p.platform,
        scheduled_for: p.scheduled_for,
        status: p.status,
      }));
      setPosts(scheduledPosts);
    }

    setLoading(false);
  };

  // Pull-to-refresh
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchPosts();
    },
  });

  useEffect(() => {
    if (sessionLoading) return;
    if (!hasSession) {
      setPosts([]);
      setLoading(false);
      return;
    }
    fetchPosts();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('portal-calendar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_posts',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, hasSession, sessionLoading]);

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

  const getPostsForDay = (day: Date) => {
    return posts.filter((post) => {
      if (!post.scheduled_for) return false;
      const localDate = convertToLocal(post.scheduled_for, userTimezone);
      return isSameDay(localDate, day);
    });
  };

  const formatLocalTime = (utcString: string) => {
    const localDate = convertToLocal(utcString, userTimezone);
    return format(localDate, "HH:mm");
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram": return "📷";
      case "facebook": return "📘";
      case "linkedin": return "💼";
      default: return "🌐";
    }
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl md:text-2xl font-bold">Content Calendar</h2>
            <Badge variant="outline" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              {userTimezone}
            </Badge>
          </div>
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
              const dayPosts = getPostsForDay(day);
              return (
                <Card key={day.toISOString()} className="p-3 md:p-4">
                  <div className="font-semibold mb-2 text-center md:text-left">
                    <span className="text-sm md:text-base">{format(day, "EEE")}</span>
                    <br />
                    <span className="text-xl md:text-2xl">{format(day, "d")}</span>
                  </div>
                  <div className="space-y-2">
                    {dayPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => {
                          setSelectedPostId(post.id);
                          setDetailModalOpen(true);
                        }}
                        className="p-2 rounded border bg-card hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">{getPlatformIcon(post.platform)}</span>
                          <Clock className="h-3 w-3" />
                          <span className="text-xs font-medium">
                            {formatLocalTime(post.scheduled_for)}
                          </span>
                        </div>
                        <p className="text-xs font-medium line-clamp-2">
                          {post.title}
                        </p>
                        <Badge
                          className={`${statusColors[post.status]} text-white text-xs mt-1`}
                        >
                          {post.status}
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
              const dayPosts = getPostsForDay(day);
              return (
                <Card key={day.toISOString()} className="p-1 md:p-2 min-h-[80px] md:min-h-[100px]">
                  <div className="text-xs md:text-sm font-semibold mb-1">
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => {
                          setSelectedPostId(post.id);
                          setDetailModalOpen(true);
                        }}
                        className={`${
                          statusColors[post.status]
                        } text-white text-xs p-1 rounded hover:opacity-80 cursor-pointer transition-opacity`}
                      >
                        <p className="line-clamp-1">{post.title}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <ScheduledPostDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        scheduledPostId={selectedPostId}
        userTimezone={userTimezone}
        onSuccess={fetchPosts}
        readOnly={true}
      />
    </div>
  );
}
