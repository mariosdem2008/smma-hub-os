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
import { CalendarDays, Clock, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHasSupabaseSession } from "@/hooks/useHasSupabaseSession";
import { convertToLocal } from "@/lib/utils";
import ScheduledPostDetailModal from "@/components/pipeline/ScheduledPostDetailModal";
import { PremiumInlineEmpty, PremiumLoading, PremiumPage } from "@/components/shared/PremiumPage";

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
  pending: "border-warning/30 bg-warning/10 text-warning",
  queued: "border-primary/30 bg-primary/10 text-primary",
  publishing: "border-info/30 bg-info/10 text-info",
  published: "border-success/30 bg-success/10 text-success",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
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
    return <PremiumLoading rows={3} />;
  }

  return (
    <PremiumPage
      eyebrow="Publishing"
      title="Content Calendar"
      description="View scheduled and published content in your local timezone."
      actions={
        <Badge variant="outline" className="text-xs">
          <Globe className="h-3 w-3 mr-1" />
          {userTimezone}
        </Badge>
      }
    >
    <div 
      className="space-y-4 md:space-y-6"
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
      
      {posts.length === 0 && (
        <PremiumInlineEmpty
          icon={CalendarDays}
          title="No scheduled content yet"
          description="Scheduled and published posts will appear here after your agency adds them to the calendar."
        />
      )}

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
                          className={`${statusColors[post.status] ?? statusColors.cancelled} text-xs mt-1`}
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
                          statusColors[post.status] ?? statusColors.cancelled
                        } cursor-pointer rounded border p-1 text-xs transition-colors hover:border-primary/50`}
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
    </PremiumPage>
  );
}
