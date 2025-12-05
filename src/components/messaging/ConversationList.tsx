import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  type: string;
  title?: string;
  latest_message?: {
    body: string;
    created_at: string;
    sender_type?: string;
  };
  unread_count: number;
  other_participant?: {
    name: string;
    email?: string;
  } | null;
  client_info?: {
    name: string;
    logo_url?: string | null;
  } | null;
  participant_count?: number;
  _optimistic?: boolean;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}

export function ConversationList({ conversations, selectedId, onSelect, isLoading = false }: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Start a new conversation to get started</p>
      </div>
    );
  }

  const getConversationDisplay = (conversation: Conversation) => {
    if (conversation._optimistic) {
      return {
        name: conversation.title || "Creating...",
        subtitle: "Creating conversation...",
        avatar: "🔄",
        icon: <MessageSquare className="h-4 w-4" />,
        isOptimistic: true,
      };
    }

    if (conversation.type === "direct" && conversation.other_participant) {
      return {
        name: conversation.other_participant.name,
        subtitle: conversation.other_participant.email,
        avatar: conversation.other_participant.name.substring(0, 2).toUpperCase(),
        icon: <User className="h-4 w-4" />,
        isOptimistic: false,
      };
    }

    if (conversation.type === "client_chat" && conversation.client_info) {
      return {
        name: conversation.client_info.name,
        subtitle: "Client Chat",
        avatar: conversation.client_info.name.substring(0, 2).toUpperCase(),
        logoUrl: conversation.client_info.logo_url,
        icon: <MessageSquare className="h-4 w-4" />,
        isOptimistic: false,
      };
    }

    if (conversation.type === "group") {
      return {
        name: conversation.title || "Group Chat",
        subtitle: conversation.participant_count ? `${conversation.participant_count} participants` : "Team Channel",
        avatar: (conversation.title || "GC").substring(0, 2).toUpperCase(),
        icon: <Users className="h-4 w-4" />,
        isOptimistic: false,
      };
    }

    return {
      name: conversation.title || "Untitled Conversation",
      subtitle: conversation.type?.replace("_", " ") || "Conversation",
      avatar: "??",
      icon: <MessageSquare className="h-4 w-4" />,
      isOptimistic: false,
    };
  };

  return (
    <div className="divide-y divide-border">
      {conversations.map((conversation) => {
        const display = getConversationDisplay(conversation);

        return (
          <button
            key={conversation.id}
            onClick={() => {
              if (!display.isOptimistic) {
                onSelect(conversation.id);
              }
            }}
            className={cn(
              "w-full p-4 text-left hover:bg-accent/50 transition-colors",
              selectedId === conversation.id && "bg-accent",
              display.isOptimistic && "opacity-60 cursor-not-allowed",
            )}
            disabled={display.isOptimistic}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                {display.logoUrl && <AvatarImage src={display.logoUrl} />}
                <AvatarFallback className={cn("text-xs", display.isOptimistic && "animate-pulse")}>
                  {display.avatar}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-semibold truncate">
                    {display.name}
                    {display.isOptimistic && " (Creating...)"}
                  </h3>
                  {conversation.unread_count > 0 && !display.isOptimistic && (
                    <Badge variant="destructive" className="ml-2 shrink-0">
                      {conversation.unread_count}
                    </Badge>
                  )}
                </div>

                {display.subtitle && <p className="text-xs text-muted-foreground truncate mb-1">{display.subtitle}</p>}

                {conversation.latest_message && !display.isOptimistic && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground truncate">{conversation.latest_message.body}</p>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conversation.latest_message.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                )}

                {display.isOptimistic && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <p className="text-xs text-blue-500">Creating conversation...</p>
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
