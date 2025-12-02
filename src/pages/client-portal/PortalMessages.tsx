import { useConversations } from '@/hooks/useConversations';
import { ConversationThread } from '@/components/messaging/ConversationThread';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';

export default function PortalMessages() {
  const { data: conversations, isLoading } = useConversations();

  // Client users only see their client chat
  const clientChat = conversations?.find((c: any) => c.type === 'client_chat');

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!clientChat) {
    return (
      <div className="container max-w-4xl py-8">
        <h1 className="text-3xl font-bold mb-6">Messages</h1>
        <div className="border border-border rounded-lg p-12 text-center">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground mb-2">No conversation available</p>
          <p className="text-sm text-muted-foreground">
            Your agency will start a conversation with you soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">Messages</h1>
      <div className="border border-border rounded-lg overflow-hidden" style={{ height: '600px' }}>
        <ConversationThread conversationId={clientChat.id} />
      </div>
    </div>
  );
}