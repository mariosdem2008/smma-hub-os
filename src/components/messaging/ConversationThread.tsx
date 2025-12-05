import { useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useMessages";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentParticipant } from "@/hooks/useCurrentParticipant";
import { useMarkConversationNotificationsRead } from "@/hooks/useNotifications";

interface ConversationThreadProps {
  conversationId?: string;
}

export function ConversationThread({ conversationId }: ConversationThreadProps) {
  const { data: messages = [], isLoading } = useMessages(conversationId);
  const { participant } = useCurrentParticipant();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { mutate: markNotificationsRead } = useMarkConversationNotificationsRead();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark notifications for this conversation as read when opened
  useEffect(() => {
    if (conversationId && !conversationId.startsWith("temp-") && !conversationId.startsWith("optimistic-")) {
      markNotificationsRead(conversationId);
    }
  }, [conversationId, markNotificationsRead]);

  // Don't show thread if no conversation is selected or it's a temporary ID
  if (!conversationId || conversationId.startsWith("temp-") || conversationId.startsWith("optimistic-")) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Select a conversation to start messaging</p>
      </div>
    );
  }

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
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message: any) => {
            // Compare sender IDs based on sender type
            const isOwnMessage = participant
              ? (message.sender_type === "agency_member" &&
                  message.sender_agency_member_id === participant.id &&
                  participant.type === "agency_member") ||
                (message.sender_type === "client_user" &&
                  message.sender_client_user_id === participant.id &&
                  participant.type === "client_user")
              : false;

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={isOwnMessage}
                conversationId={conversationId}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border bg-card">
        <MessageInput conversationId={conversationId} />
      </div>
    </div>
  );
}
