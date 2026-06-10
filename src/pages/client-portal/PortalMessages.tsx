import { useConversations } from '@/hooks/useConversations';
import { ConversationThread } from '@/components/messaging/ConversationThread';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';
import { PremiumInlineEmpty, PremiumPage } from '@/components/shared/PremiumPage';

export default function PortalMessages() {
  const { data: conversations, isLoading } = useConversations();

  // Client users only see their client chat
  const clientChat = conversations?.find((c: any) => c.type === 'client_chat');

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!clientChat) {
    return (
      <PremiumPage
        eyebrow="Client Chat"
        title="Messages"
        description="Keep approvals, questions, and campaign feedback in one thread."
      >
        <PremiumInlineEmpty
          icon={MessageSquare}
          title="No conversation available"
          description="Your agency will start a conversation with you soon."
        />
      </PremiumPage>
    );
  }

  return (
    <PremiumPage
      eyebrow="Client Chat"
      title="Messages"
      description="Keep approvals, questions, and campaign feedback in one thread."
      className="mx-auto max-w-4xl"
    >
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card" style={{ height: '600px' }}>
        <ConversationThread conversationId={clientChat.id} />
      </div>
    </PremiumPage>
  );
}
