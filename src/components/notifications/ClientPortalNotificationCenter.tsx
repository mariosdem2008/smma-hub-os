import { useState } from 'react';
import { Bell, MessageSquare, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export function ClientPortalNotificationCenter() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { portalSlug } = useParams();
  const { data: notifications, isLoading } = useNotifications();
  const { data: unreadCount } = useUnreadNotificationsCount();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  // Filter to only show new_message and approval_reminder for client portal
  const clientNotifications = notifications?.filter(
    n => n.type === 'new_message' || n.type === 'approval_reminder'
  );

  const clientUnreadCount = clientNotifications?.filter(n => !n.read_at).length || 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_message':
        return <MessageSquare className="h-4 w-4 text-primary" />;
      case 'approval_reminder':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationTitle = (notification: any) => {
    switch (notification.type) {
      case 'new_message':
        return `New message from ${notification.payload?.sender_name || 'Agency'}`;
      case 'approval_reminder':
        return notification.payload?.message || 'Content awaiting your approval';
      default:
        return 'Notification';
    }
  };

  const handleNotificationClick = (notification: any) => {
    markRead(notification.id);
    
    if (notification.type === 'new_message' && notification.conversation_id) {
      navigate(`/client/portal/${portalSlug}/messages`);
    } else if (notification.type === 'approval_reminder') {
      navigate(`/client/portal/${portalSlug}/approvals`);
    }
    
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {clientUnreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {clientUnreadCount > 9 ? '9+' : clientUnreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-semibold">Notifications</h4>
          {clientUnreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs"
              onClick={() => markAllRead()}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : clientNotifications?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clientNotifications?.map((notification) => (
                <button
                  key={notification.id}
                  className={cn(
                    'w-full p-4 text-left hover:bg-muted/50 transition-colors',
                    !notification.read_at && 'bg-primary/5'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm',
                        !notification.read_at && 'font-medium'
                      )}>
                        {getNotificationTitle(notification)}
                      </p>
                      {notification.payload?.snippet && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {notification.payload.snippet}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
