// Global Client Right Panel - AI Chat, Decisions, History, Tasks
// Accessible from all ClientDetail tabs as a slide-in panel

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStrategies } from '@/hooks/useStrategies';
import { useStrategyHistory, groupHistoryByDate } from '@/hooks/useStrategyHistory';
import { useStrategyTasks, getTaskCounts, useUpdateTaskStatus } from '@/hooks/useStrategyTasks';
import { HISTORY_EVENT_LABELS, getModuleDefinition, TASK_PRIORITY_CONFIG } from '@/lib/strategy/constants';
import type { HistoryEventType, TaskStatus, TaskPriority } from '@/lib/strategy/types';
import { toast } from 'sonner';
import {
  Bot,
  Scale,
  History,
  ListTodo,
  Send,
  User,
  X,
  MessageSquare,
  FileEdit,
  Lock,
  Unlock,
  CheckCircle,
  Circle,
  Sparkles,
  ArrowRight,
  Clock,
  Loader2,
} from 'lucide-react';

export type RightPanelTab = 'ai' | 'decisions' | 'history' | 'tasks';

interface ClientRightPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const eventIcons: Record<HistoryEventType, typeof FileEdit> = {
  created: FileEdit,
  updated: FileEdit,
  locked: Lock,
  unlocked: Unlock,
  seeded: Sparkles,
  approved: CheckCircle,
  task_created: ListTodo,
  task_generated: ListTodo,
  task_pushed: ArrowRight,
};

export function ClientRightPanel({
  open,
  onOpenChange,
  clientId,
}: ClientRightPanelProps) {
  const [panelTab, setPanelTab] = useState<RightPanelTab>('ai');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `I'm your Client AI Assistant. I can help you with:
• Strategy planning and content
• Answering questions about this client
• Generating ideas and suggestions

What would you like help with?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch active strategy for this client
  const { data: strategies = [] } = useStrategies(clientId);
  const activeStrategy = strategies[0];
  const strategyId = activeStrategy?.id ?? '';

  // Fetch history and tasks
  const { data: history = [], isLoading: historyLoading } = useStrategyHistory(clientId, strategyId, 100);
  const { data: tasks = [], isLoading: tasksLoading } = useStrategyTasks(clientId, strategyId);
  const updateStatus = useUpdateTaskStatus();

  const groupedHistory = groupHistoryByDate(history);
  const taskCounts = getTaskCounts(tasks);

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

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateStatus.mutateAsync({ taskId, clientId, strategyId, status });
    } catch {
      toast.error('Failed to update task');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[400px] md:w-[450px] p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">AI Assistant</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs
            value={panelTab}
            onValueChange={(v) => setPanelTab(v as RightPanelTab)}
            className="flex flex-col h-full"
          >
            {/* Tab List */}
            <div className="border-b px-2 py-2">
              <TabsList className="w-full grid grid-cols-4 h-9">
                <TabsTrigger value="ai" className="text-xs gap-1 px-2">
                  <Bot className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">AI</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs gap-1 px-2">
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">History</span>
                </TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs gap-1 px-2">
                  <ListTodo className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tasks</span>
                </TabsTrigger>
                <TabsTrigger value="decisions" className="text-xs gap-1 px-2">
                  <Scale className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Decisions</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {/* AI Tab */}
              <TabsContent value="ai" className="h-full m-0 p-0 flex flex-col">
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

                <div className="p-3 border-t space-y-2">
                  <div className="flex gap-2">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about this client..."
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
                </div>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="h-full m-0 p-0 overflow-y-auto">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                    <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No history yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Events will appear here as you work on your strategy
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="p-3 space-y-4">
                      {Array.from(groupedHistory.entries()).map(([date, events]) => (
                        <div key={date}>
                          <h4 className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                            {date}
                          </h4>
                          <div className="space-y-2">
                            {events.map((event) => {
                              const eventType = event.event_type as HistoryEventType;
                              const Icon = eventIcons[eventType] ?? FileEdit;
                              const moduleDef = event.module ? getModuleDefinition(event.module) : null;
                              const time = new Date(event.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              });

                              return (
                                <div
                                  key={event.id}
                                  className="flex gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                  <div
                                    className={cn(
                                      'rounded-full p-1.5 flex-shrink-0',
                                      eventType === 'seeded' && 'bg-purple-500/10 text-purple-400',
                                      eventType === 'locked' && 'bg-red-500/10 text-red-400',
                                      eventType === 'unlocked' && 'bg-green-500/10 text-green-400',
                                      eventType === 'approved' && 'bg-green-500/10 text-green-400',
                                      eventType === 'updated' && 'bg-blue-500/10 text-blue-400',
                                      eventType === 'created' && 'bg-blue-500/10 text-blue-400'
                                    )}
                                  >
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-sm font-medium truncate">
                                        {HISTORY_EVENT_LABELS[eventType] ?? eventType}
                                      </p>
                                      <span className="text-xs text-muted-foreground flex-shrink-0">
                                        {time}
                                      </span>
                                    </div>
                                    {moduleDef && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {moduleDef.label}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="h-full m-0 p-0 flex flex-col">
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">Tasks</h3>
                    <Badge variant="secondary" className="text-xs">
                      {tasks.length} total
                    </Badge>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{taskCounts.todo} to do</span>
                    <span>•</span>
                    <span>{taskCounts.in_progress} active</span>
                    <span>•</span>
                    <span>{taskCounts.completed} done</span>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {tasksLoading ? (
                      <div className="flex items-center justify-center h-20">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : tasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-20 text-center">
                        <ListTodo className="h-6 w-6 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">No tasks yet</p>
                      </div>
                    ) : (
                      tasks.map((task) => {
                        const priorityConfig = TASK_PRIORITY_CONFIG[task.priority as TaskPriority];
                        const isCompleted = task.status === 'completed' || task.status === 'pushed';

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              'p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors',
                              isCompleted && 'opacity-60'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() =>
                                  handleStatusChange(
                                    task.id,
                                    task.status === 'completed' ? 'todo' : 'completed'
                                  )
                                }
                                className="mt-0.5 flex-shrink-0"
                              >
                                {isCompleted ? (
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <p
                                  className={cn(
                                    'text-sm',
                                    isCompleted && 'line-through text-muted-foreground'
                                  )}
                                >
                                  {task.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className={cn('text-[10px] px-1.5', priorityConfig?.bgColor)}
                                  >
                                    {priorityConfig?.label}
                                  </Badge>
                                  {task.status === 'pushed' && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 bg-green-500/10">
                                      Pushed
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Decisions Tab */}
              <TabsContent value="decisions" className="h-full m-0 p-0">
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <Scale className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-1">Strategy Decisions</p>
                  <p className="text-xs text-muted-foreground">
                    Go to Strategy tab to manage module decisions and locks
                  </p>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Floating toggle button for opening the panel
interface ClientRightPanelTriggerProps {
  onClick: () => void;
  className?: string;
}

export function ClientRightPanelTrigger({ onClick, className }: ClientRightPanelTriggerProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        'fixed bottom-20 right-4 z-40 rounded-full h-14 w-14 shadow-lg md:bottom-6',
        className
      )}
    >
      <MessageSquare className="h-6 w-6" />
      <span className="sr-only">Open AI Assistant</span>
    </Button>
  );
}

export default ClientRightPanel;
