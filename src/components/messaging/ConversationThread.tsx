import { useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useMessages";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentParticipant } from "@/hooks/useCurrentParticipant";
import { useMarkConversationNotificationsRead } from "@/hooks/useNotifications";
import { AlertCircle, MessageCircle } from "lucide-react";

interface ConversationThreadProps {
  conversationId?: string;
}

export function ConversationThread({ conversationId }: ConversationThreadProps) {
  const { data: messages = [], isLoading, error } = useMessages(conversationId);
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
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <MessageCircle className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-center">Select a conversation to start messaging</p>
        <p className="text-sm text-center mt-1">or create a new conversation</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium">Failed to load messages</p>
        <p className="text-sm text-muted-foreground text-center mt-1">{error.message || "Please try again later"}</p>
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
          <Skeleton className="h-16 w-1/2 ml-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8" />
            </div>
            <p className="text-center font-medium">No messages yet</p>
            <p className="text-sm text-center mt-1">Send a message to start the conversation</p>
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
