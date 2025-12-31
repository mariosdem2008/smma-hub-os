// Strategy OS - AI Assistant Tab

import { useState } from 'react';
import { useStrategyOS } from '../StrategyOSContext';
import { GenerateStrategyButton } from '../shared/GenerateStrategyButton';
import { AI_COPILOT_MODES } from '@/lib/strategy/constants';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Send, Bot, User, Sparkles, AlertTriangle } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIAssistantTab() {
  const { aiCopilotMode, setAICopilotMode, activeView } = useStrategyOS();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `I'm your Strategy AI Copilot. I can help you with:
• Generating and improving strategy content
• Answering questions about your modules
• Suggesting tasks and next steps

What would you like help with?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response (in production, this would call an edge function)
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you want help with: "${userMessage.content}".

Currently viewing: ${activeView === 'mission-control' ? 'Mission Control' : activeView.replace('_', ' ')}

In ${aiCopilotMode} mode, I would ${
          aiCopilotMode === 'assist'
            ? 'show you suggestions that you can manually apply'
            : aiCopilotMode === 'draft'
            ? 'generate a draft for your approval'
            : 'automatically apply changes (requires confirmation)'
        }.

This is a placeholder response. Full AI integration coming soon.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector */}
      <div className="p-3 border-b border-border/50">
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          {AI_COPILOT_MODES.map((mode) => (
            <Button
              key={mode.key}
              variant="ghost"
              size="sm"
              onClick={() => !mode.gated && setAICopilotMode(mode.key)}
              disabled={mode.gated}
              className={cn(
                'flex-1 text-xs h-8',
                aiCopilotMode === mode.key && 'bg-background shadow-sm'
              )}
            >
              {mode.label}
              {mode.gated && <AlertTriangle className="ml-1 h-3 w-3 text-muted-foreground" />}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {AI_COPILOT_MODES.find((m) => m.key === aiCopilotMode)?.description}
        </p>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-2',
                message.role === 'user' && 'flex-row-reverse'
              )}
            >
              <div
                className={cn(
                  'rounded-full p-1.5 flex-shrink-0',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.role === 'user' ? (
                  <User className="h-3 w-3" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
              </div>
              <div
                className={cn(
                  'rounded-lg px-3 py-2 text-sm max-w-[85%]',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="rounded-full bg-muted p-1.5">
                <Bot className="h-3 w-3" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 border-t border-border/50 space-y-2">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about strategy..."
            className="min-h-[60px] resize-none text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-auto"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <GenerateStrategyButton variant="outline" size="sm" className="w-full" />
      </div>
    </div>
  );
}

export default AIAssistantTab;
