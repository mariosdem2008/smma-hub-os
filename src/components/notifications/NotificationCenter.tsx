import { useState } from 'react';
import { Bell, MessageSquare, AlertTriangle, Clock, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const { data: unreadCount } = useUnreadNotificationsCount();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_message':
        return <MessageSquare className="h-4 w-4 text-primary" />;
      case 'failed_post':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'approval_reminder':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'project_assigned':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'stage_changed':
        return <Bell className="h-4 w-4 text-green-500" />;
      case 'client_approved':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'client_rejected':
        return <X className="h-4 w-4 text-destructive" />;
      case 'comment_added':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'final_asset_uploaded':
        return <Bell className="h-4 w-4 text-purple-500" />;
      case 'publish_success':
        return <Check className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationTitle = (notification: any) => {
    switch (notification.type) {
      case 'new_message':
        return `New message from ${notification.payload?.sender_name || 'Someone'}`;
      case 'failed_post':
        return `Post failed: ${notification.payload?.project_title || 'Unknown project'}`;
      case 'approval_reminder':
        return notification.payload?.message || 'Content awaiting approval';
      case 'project_assigned':
        return `Assigned to: ${notification.payload?.project_title || 'Project'}`;
      case 'stage_changed':
        return `Project moved to ${notification.payload?.new_stage || 'new stage'}`;
      case 'client_approved':
        return `Client approved: ${notification.payload?.project_title || 'Project'}`;
      case 'client_rejected':
        return `Changes requested: ${notification.payload?.project_title || 'Project'}`;
      case 'comment_added':
        return `New comment on ${notification.payload?.project_title || 'project'}`;
      case 'final_asset_uploaded':
        return `Final content uploaded: ${notification.payload?.project_title || 'Project'}`;
      case 'publish_success':
        return `Published: ${notification.payload?.project_title || 'Project'}`;
      default:
        return notification.payload?.message || 'Notification';
    }
  };

  const getNotificationDescription = (notification: any) => {
    switch (notification.type) {
      case 'new_message':
        return notification.payload?.snippet || '';
      case 'failed_post':
        return `Platform: ${notification.payload?.platform || 'Unknown'} - ${notification.payload?.error_message || 'Unknown error'}`;
      case 'approval_reminder':
        return notification.payload?.client_name ? `Client: ${notification.payload.client_name}` : '';
      case 'project_assigned':
        return notification.payload?.client_name ? `Client: ${notification.payload.client_name}` : '';
      case 'stage_changed':
        return notification.payload?.project_title || '';
      case 'client_approved':
      case 'client_rejected':
        return notification.payload?.client_name ? `Client: ${notification.payload.client_name}` : '';
      case 'comment_added':
        return notification.payload?.comment_preview || '';
      case 'final_asset_uploaded':
        return notification.payload?.client_name ? `Client: ${notification.payload.client_name}` : '';
      case 'publish_success':
        return notification.payload?.platform ? `Platform: ${notification.payload.platform}` : '';
      default:
        return '';
    }
  };

  const handleNotificationClick = (notification: any) => {
    markRead(notification.id);
    
    if (notification.type === 'new_message' && notification.conversation_id) {
      navigate('/messages');
    } else if (notification.project_id) {
      navigate(`/clients`);
    }
    
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {(unreadCount || 0) > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="font-semibold">Notifications</h4>
          {(unreadCount || 0) > 0 && (
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

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : notifications?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications?.map((notification) => (
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
                      {getNotificationDescription(notification) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {getNotificationDescription(notification)}
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
