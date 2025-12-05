import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, Smile } from "lucide-react";
import { useSendMessage } from "@/hooks/useSendMessage";
import { useCurrentParticipant } from "@/hooks/useCurrentParticipant";

interface MessageInputProps {
  conversationId: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mutate: sendMessage, isPending } = useSendMessage();
  const { participant } = useCurrentParticipant();

  useEffect(() => {
    // Auto-focus on mount
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSend = () => {
    if (!text.trim() || isPending || !participant) return;

    sendMessage({
      conversation_id: conversationId,
      sender_type: participant.type,
      sender_id: participant.id,
      text: text.trim(),
    });

    setText("");

    // Refocus textarea after sending
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="p-4 border-t">
      <div className="flex items-end gap-2">
        <Button size="icon" variant="ghost" disabled title="Emoji picker coming soon" className="shrink-0">
          <Smile className="h-4 w-4" />
        </Button>

        <Button size="icon" variant="ghost" disabled title="File attachments coming soon" className="shrink-0">
          <Paperclip className="h-4 w-4" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="min-h-[44px] max-h-[120px] resize-none pr-12"
            disabled={isPending}
            rows={1}
          />
        </div>

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || isPending || !participant}
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">Press Enter to send • Shift+Enter for new line</p>
    </div>
  );
}
