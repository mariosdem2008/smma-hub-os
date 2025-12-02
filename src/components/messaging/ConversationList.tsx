import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  type: string;
  title?: string;
  latest_message?: {
    body: string;
    created_at: string;
  };
  unread_count: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          className={cn(
            'w-full p-4 text-left hover:bg-accent/50 transition-colors',
            selectedId === conversation.id && 'bg-accent'
          )}
        >
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-semibold truncate flex-1">
              {conversation.title || 'Untitled Conversation'}
            </h3>
            {conversation.unread_count > 0 && (
              <Badge variant="destructive" className="ml-2">
                {conversation.unread_count}
              </Badge>
            )}
          </div>
          {conversation.latest_message && (
            <>
              <p className="text-sm text-muted-foreground truncate mb-1">
                {conversation.latest_message.body}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(conversation.latest_message.created_at), {
                  addSuffix: true,
                })}
              </p>
            </>
          )}
        </button>
      ))}
    </div>
  );
}