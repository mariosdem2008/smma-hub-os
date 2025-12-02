import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Paperclip } from 'lucide-react';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useCurrentParticipant } from '@/hooks/useCurrentParticipant';

interface MessageInputProps {
  conversationId: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [text, setText] = useState('');
  const { mutate: sendMessage, isPending } = useSendMessage();
  const { participant } = useCurrentParticipant();

  const handleSend = () => {
    if (!text.trim() || isPending || !participant) return;

    sendMessage({
      conversation_id: conversationId,
      sender_type: participant.type,
      sender_id: participant.id, // Pass sender ID for optimistic updates
      text: text.trim(),
    });

    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4">
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="min-h-[60px] resize-none"
          disabled={isPending}
        />
        <div className="flex flex-col gap-2">
          <Button
            size="icon"
            variant="ghost"
            disabled
            title="File attachments coming soon"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || isPending || !participant}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}