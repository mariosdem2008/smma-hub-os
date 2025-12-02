import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageSquare, Users, UserCircle } from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { ConversationList } from '@/components/messaging/ConversationList';
import { ConversationThread } from '@/components/messaging/ConversationThread';
import { Skeleton } from '@/components/ui/skeleton';

export default function Messages() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const { data: conversations, isLoading } = useConversations();

  const directConversations = conversations?.filter((c: any) => c.type === 'direct') || [];
  const groupConversations = conversations?.filter((c: any) => c.type === 'group') || [];
  const clientConversations = conversations?.filter((c: any) => c.type === 'client_chat') || [];

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-80 border-r border-border p-4">
          <Skeleton className="h-10 mb-4" />
          <Skeleton className="h-16 mb-2" />
          <Skeleton className="h-16 mb-2" />
          <Skeleton className="h-16 mb-2" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-80 border-r border-border bg-card">
        <Tabs defaultValue="direct" className="h-full flex flex-col">
          <div className="p-4 border-b border-border">
            <h1 className="text-2xl font-bold mb-4">Messages</h1>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="direct" className="gap-2">
                <UserCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Direct</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Team</span>
              </TabsTrigger>
              <TabsTrigger value="clients" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Clients</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="direct" className="flex-1 overflow-y-auto m-0">
            <ConversationList
              conversations={directConversations}
              selectedId={selectedConversationId}
              onSelect={setSelectedConversationId}
            />
          </TabsContent>

          <TabsContent value="team" className="flex-1 overflow-y-auto m-0">
            <ConversationList
              conversations={groupConversations}
              selectedId={selectedConversationId}
              onSelect={setSelectedConversationId}
            />
          </TabsContent>

          <TabsContent value="clients" className="flex-1 overflow-y-auto m-0">
            <ConversationList
              conversations={clientConversations}
              selectedId={selectedConversationId}
              onSelect={setSelectedConversationId}
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex-1">
        {selectedConversationId ? (
          <ConversationThread conversationId={selectedConversationId} />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}