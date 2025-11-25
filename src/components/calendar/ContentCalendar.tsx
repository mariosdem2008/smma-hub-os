import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./calendar-styles.css";

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales,
});

const Calendar = withDragAndDrop(BigCalendar);

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  content_type: string | null;
  final_caption: string | null;
  platforms: string[] | null;
  scheduled_time: string | null;
  pipeline_stage: string;
  thumbnail_url: string | null;
  post_url: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Asset;
}

interface ContentCalendarProps {
  clientId: string;
}

export default function ContentCalendar({ clientId }: ContentCalendarProps) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    fetchAssets();

    // Real-time subscription
    const channel = supabase
      .channel('content-calendar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assets',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          fetchAssets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('client_id', clientId)
        .in('pipeline_stage', ['approved', 'scheduled', 'published'])
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      setAssets(data || []);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error",
        description: "Failed to load calendar content",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEventDrop = async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ 
          scheduled_time: start.toISOString(),
          pipeline_stage: 'scheduled' // Auto-move to scheduled when date is set
        })
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: "Rescheduled",
        description: `${event.title} moved to ${format(start, 'PPP p')}`
      });

      fetchAssets();
    } catch (error: any) {
      console.error("Error rescheduling:", error);
      toast({
        title: "Error",
        description: "Failed to reschedule content",
        variant: "destructive"
      });
    }
  };

  const handleEventResize = async ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
    // For now, treat resize as a reschedule
    await handleEventDrop({ event, start, end });
  };

  const events: CalendarEvent[] = useMemo(() => {
    return assets
      .filter(asset => asset.scheduled_time || asset.pipeline_stage === 'approved')
      .map(asset => {
        const startDate = asset.scheduled_time 
          ? new Date(asset.scheduled_time)
          : new Date(); // Unscheduled approved items show today

        return {
          id: asset.id,
          title: asset.filename,
          start: startDate,
          end: new Date(startDate.getTime() + 60 * 60 * 1000), // 1 hour duration
          resource: asset
        };
      });
  }, [assets]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const asset = event.resource;
    let backgroundColor = 'hsl(var(--primary))';
    
    if (asset.pipeline_stage === 'approved') {
      backgroundColor = 'hsl(150 70% 50%)'; // Green
    } else if (asset.pipeline_stage === 'scheduled') {
      backgroundColor = 'hsl(200 70% 50%)'; // Blue
    } else if (asset.pipeline_stage === 'published') {
      backgroundColor = 'hsl(120 70% 50%)'; // Dark green
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0',
        display: 'block'
      }
    };
  }, []);

  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const asset = event.resource;
    return (
      <div className="p-1 space-y-1">
        <div className="font-medium text-xs truncate">{event.title}</div>
        {asset.platforms && asset.platforms.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {asset.platforms.slice(0, 2).map(platform => (
              <Badge key={platform} variant="secondary" className="text-[10px] px-1 py-0">
                {platform}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  const UnscheduledSection = () => {
    const unscheduledApproved = assets.filter(
      a => a.pipeline_stage === 'approved' && !a.scheduled_time
    );

    if (unscheduledApproved.length === 0) return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg">Unscheduled (Approved)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {unscheduledApproved.map(asset => (
              <Card key={asset.id} className="cursor-move hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  {asset.file_type.startsWith('video') ? (
                    <video
                      src={asset.thumbnail_url || asset.file_url}
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                  ) : (
                    <img
                      src={asset.file_url}
                      alt={asset.filename}
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                  )}
                  <div className="text-xs font-medium truncate">{asset.filename}</div>
                  <Badge variant="secondary" className="text-[10px] mt-1">Approved</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          <h2 className="text-2xl font-bold">Content Calendar</h2>
        </div>
        
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex gap-4 items-center">
        <Badge variant="outline" className="bg-[hsl(150,70%,50%)] text-white">
          Approved: {assets.filter(a => a.pipeline_stage === 'approved').length}
        </Badge>
        <Badge variant="outline" className="bg-[hsl(200,70%,50%)] text-white">
          Scheduled: {assets.filter(a => a.pipeline_stage === 'scheduled').length}
        </Badge>
        <Badge variant="outline" className="bg-[hsl(120,70%,50%)] text-white">
          Published: {assets.filter(a => a.pipeline_stage === 'published').length}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 700 }}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            eventPropGetter={eventStyleGetter}
            components={{
              event: EventComponent
            }}
            draggableAccessor={() => true}
            resizable
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            popup
            selectable
          />
        </CardContent>
      </Card>

      <UnscheduledSection />
    </div>
  );
}
