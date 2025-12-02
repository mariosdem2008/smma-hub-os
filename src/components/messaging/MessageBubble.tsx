import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MessageBubbleProps {
  message: {
    id: string;
    body?: string;
    attachment_url?: string;
    created_at: string;
    related_project_id?: string;
    sender_type: string;
    read_receipts?: any[];
  };
  isOwnMessage: boolean;
}

export function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        'flex flex-col',
        isOwnMessage ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-lg p-3 shadow-sm',
          isOwnMessage
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {message.body && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.body}
          </p>
        )}

        {message.attachment_url && (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm underline mt-2"
          >
            <ExternalLink className="h-4 w-4" />
            View attachment
          </a>
        )}

        {message.related_project_id && (
          <Link
            to={`/projects/${message.related_project_id}`}
            className="inline-block mt-2"
          >
            <Badge variant="outline" className="cursor-pointer">
              Related to Project
            </Badge>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 mt-1 px-1">
        <span className="text-xs text-muted-foreground">
          {format(new Date(message.created_at), 'p')}
        </span>
        {isOwnMessage && message.read_receipts && message.read_receipts.length > 0 && (
          <span className="text-xs text-muted-foreground">• Read</span>
        )}
      </div>
    </div>
  );
}