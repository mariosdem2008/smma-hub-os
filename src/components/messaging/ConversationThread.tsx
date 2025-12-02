import { useEffect, useRef } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentParticipant } from '@/hooks/useCurrentParticipant';
import { useMarkConversationNotificationsRead } from '@/hooks/useNotifications';

interface ConversationThreadProps {
  conversationId: string;
}

export function ConversationThread({ conversationId }: ConversationThreadProps) {
  const { data: messages, isLoading } = useMessages(conversationId);
  const { participant } = useCurrentParticipant();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { mutate: markNotificationsRead } = useMarkConversationNotificationsRead();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark notifications for this conversation as read when opened
  useEffect(() => {
    if (conversationId) {
      markNotificationsRead(conversationId);
    }
  }, [conversationId, markNotificationsRead]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-16 w-2/3 ml-auto" />
          <Skeleton className="h-16 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages?.map((message: any) => {
          // Compare sender IDs based on sender type
          const isOwnMessage = participant
            ? (message.sender_type === 'agency_member' && message.sender_agency_member_id === participant.id && participant.type === 'agency_member') ||
              (message.sender_type === 'client_user' && message.sender_client_user_id === participant.id && participant.type === 'client_user')
            : false;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={isOwnMessage}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border bg-card">
        <MessageInput conversationId={conversationId} />
      </div>
    </div>
  );
}