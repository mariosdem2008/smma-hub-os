import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, parseISO } from "date-fns";
import { CalendarDays, Clock, Edit, Copy, X, ArrowRight, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { convertToLocal, convertToUTC } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface CalendarTabProps {
  clientId: string;
}

interface ScheduledItem {
  id: string;
  title: string;
  scheduled_time: string | null;
  pipeline_stage: string;
  type: 'project' | 'asset';
  error_message: string | null;
}

const stageColors: Record<string, string> = {
  approved: "bg-yellow-500",
  scheduled: "bg-blue-500",
  published: "bg-green-500",
  failed: "bg-red-500",
};

export default function CalendarTab({ clientId }: CalendarTabProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month" | "queue">("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ScheduledItem | null>(null);
  const [newScheduledDate, setNewScheduledDate] = useState("");
  const [newScheduledTime, setNewScheduledTime] = useState("");
  const [draggedItem, setDraggedItem] = useState<ScheduledItem | null>(null);
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
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, title, scheduled_time, pipeline_stage, error_message")
        .eq("client_id", clientId)
        .in("pipeline_stage", ["scheduled", "published", "failed"])
        .not("scheduled_time", "is", null);

      if (projectsError) throw projectsError;

      const scheduledItems: ScheduledItem[] = (projects || []).map(p => ({
        id: p.id,
        title: p.title,
        scheduled_time: p.scheduled_time,
        pipeline_stage: p.pipeline_stage,
        type: 'project' as const,
        error_message: p.error_message,
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
      // Convert UTC time to local time for comparison
      const localDate = convertToLocal(item.scheduled_time, userTimezone);
      return isSameDay(localDate, day);
    });
  };

  const formatLocalTime = (utcString: string) => {
    const localDate = convertToLocal(utcString, userTimezone);
    return format(localDate, "HH:mm");
  };

  const formatLocalDateTime = (utcString: string) => {
    const localDate = convertToLocal(utcString, userTimezone);
    return format(localDate, "MMM d, yyyy 'at' h:mm a");
  };

  const handleOpenRescheduleDialog = (item: ScheduledItem) => {
    setSelectedItem(item);
    if (item.scheduled_time) {
      // Convert UTC to local time for editing
      const localDate = convertToLocal(item.scheduled_time, userTimezone);
      setNewScheduledDate(format(localDate, "yyyy-MM-dd"));
      setNewScheduledTime(format(localDate, "HH:mm"));
    }
    setRescheduleDialogOpen(true);
  };

  const handleReschedule = async () => {
    if (!selectedItem || !newScheduledDate || !newScheduledTime) return;

    try {
      const scheduledDateTime = new Date(`${newScheduledDate}T${newScheduledTime}`);
      
      // Convert local time to UTC before saving
      const utcDateTime = convertToUTC(scheduledDateTime, userTimezone);
      
      const { error } = await supabase
        .from("projects")
        .update({ scheduled_time: utcDateTime })
        .eq("id", selectedItem.id);

      if (error) throw error;

      toast({
        title: "Post rescheduled",
        description: `Successfully rescheduled to ${format(scheduledDateTime, "MMM d, yyyy 'at' h:mm a")} (${userTimezone})`,
      });

      setRescheduleDialogOpen(false);
      fetchScheduledItems();
    } catch (error: any) {
      toast({
        title: "Error rescheduling",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (item: ScheduledItem) => {
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (day: Date) => {
    if (!draggedItem) return;

    try {
      // Keep the same time, just change the day (in local timezone)
      const localDate = convertToLocal(draggedItem.scheduled_time!, userTimezone);
      const newDate = new Date(day);
      newDate.setHours(localDate.getHours(), localDate.getMinutes(), 0, 0);

      // Convert to UTC before saving
      const utcDateTime = convertToUTC(newDate, userTimezone);

      const { error } = await supabase
        .from("projects")
        .update({ scheduled_time: utcDateTime })
        .eq("id", draggedItem.id);

      if (error) throw error;

      toast({
        title: "Post moved",
        description: `Moved to ${format(newDate, "MMM d, yyyy 'at' h:mm a")} (${userTimezone})`,
      });

      setDraggedItem(null);
      fetchScheduledItems();
    } catch (error: any) {
      toast({
        title: "Error moving post",
        description: error.message,
        variant: "destructive",
      });
      setDraggedItem(null);
    }
  };

  const handleDuplicate = async (item: ScheduledItem) => {
    try {
      // Fetch the full project details
      const { data: project, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", item.id)
        .single();

      if (fetchError) throw fetchError;

      // Create a duplicate project
      const { data: newProject, error: insertError } = await supabase
        .from("projects")
        .insert({
          client_id: project.client_id,
          agency_id: project.agency_id,
          title: `${project.title} (Copy)`,
          pipeline_stage: "idea",
          platforms: project.platforms,
          platform_captions: project.platform_captions,
          hashtags: project.hashtags,
          notes: project.notes,
          scheduled_time: null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "Post duplicated",
        description: "The post has been duplicated and moved to Idea stage",
      });

      fetchScheduledItems();
    } catch (error: any) {
      toast({
        title: "Error duplicating",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancel = async (item: ScheduledItem) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ 
          pipeline_stage: "approved",
          scheduled_time: null 
        })
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Post cancelled",
        description: "The post has been moved back to Approved stage",
      });

      fetchScheduledItems();
    } catch (error: any) {
      toast({
        title: "Error cancelling",
        description: error.message,
        variant: "destructive",
      });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Calendar</h2>
          <p className="text-muted-foreground">
            Manage your scheduled and published content
          </p>
        </div>
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
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(day)}
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
                        draggable
                        onDragStart={() => handleDragStart(item)}
                        onClick={() => handleOpenRescheduleDialog(item)}
                        className="p-2 rounded border bg-card cursor-move hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">
                            {item.scheduled_time
                              ? formatLocalTime(item.scheduled_time)
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
                <Card 
                  key={day.toISOString()} 
                  className="p-2 min-h-[100px]"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(day)}
                >
                  <div className="text-sm font-semibold mb-1">
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => handleDragStart(item)}
                        onClick={() => handleOpenRescheduleDialog(item)}
                        className={`${
                          stageColors[item.pipeline_stage]
                        } text-white text-xs p-1 rounded cursor-move hover:opacity-80 transition-opacity`}
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

          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {items.length === 0 ? (
                <Card className="p-8 text-center">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No scheduled posts yet</p>
                </Card>
              ) : (
                items.map((item, index) => (
                  <Card key={item.id} className="p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={`${stageColors[item.pipeline_stage]} text-white`}>
                            {item.pipeline_stage}
                          </Badge>
                          {item.scheduled_time && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatLocalDateTime(item.scheduled_time)}
                              </span>
                            </div>
                          )}
                        </div>
                        <h4 className="font-medium mb-1">{item.title}</h4>
                        {item.error_message && (
                          <div className="flex items-center gap-2 text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded">
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                            <span>{item.error_message}</span>
                          </div>
                        )}
                        {index < items.length - 1 && item.scheduled_time && items[index + 1].scheduled_time && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                            <ArrowRight className="h-3 w-3" />
                            <span>
                              {Math.floor(
                                (parseISO(items[index + 1].scheduled_time!).getTime() - 
                                parseISO(item.scheduled_time).getTime()) / 
                                (1000 * 60 * 60)
                              )} hours until next post
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenRescheduleDialog(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDuplicate(item)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(item)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Post</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{selectedItem.title}</h4>
                <p className="text-sm text-muted-foreground">
                  Current schedule:{" "}
                  {selectedItem.scheduled_time &&
                    formatLocalDateTime(selectedItem.scheduled_time)} ({userTimezone})
                </p>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label>New Date</Label>
                  <Input
                    type="date"
                    value={newScheduledDate}
                    onChange={(e) => setNewScheduledDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>New Time</Label>
                  <Input
                    type="time"
                    value={newScheduledTime}
                    onChange={(e) => setNewScheduledTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReschedule}>
                  Reschedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
