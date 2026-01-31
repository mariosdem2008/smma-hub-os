// Global Client Right Panel - AI Chat, Decisions, History, Tasks
// Accessible from all ClientDetail tabs as a slide-in panel

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useStrategies } from '@/hooks/useStrategies';
import { useStrategyHistory, groupHistoryByDate } from '@/hooks/useStrategyHistory';
import { useStrategyTasks, getTaskCounts, useUpdateTaskStatus } from '@/hooks/useStrategyTasks';
import { useStrategyModules, useUpdateModuleContent } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import { useAiAssistant, AiAssistantError } from '@/hooks/useAiAssistant';
import { HISTORY_EVENT_LABELS, getModuleDefinition, TASK_PRIORITY_CONFIG } from '@/lib/strategy/constants';
import type { HistoryEventType, TaskStatus, TaskPriority, StrategyModule } from '@/lib/strategy/types';
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
  Wand2,
  Undo2,
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

type AppliedChange = {
  id: string;
  appliedAt: number;
  changes: Array<{
    module: StrategyModule;
    moduleId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }>;
};

function safeUuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return String(Date.now());
  }
}

function isStrategyModule(value: unknown): value is StrategyModule {
  return (
    value === 'positioning' ||
    value === 'pillars' ||
    value === 'campaign_plan' ||
    value === 'weekly_plan' ||
    value === 'channel_adaptations' ||
    value === 'rules_constraints'
  );
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
      id: 'welcome',
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
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lastProposals, setLastProposals] = useState<any[]>([]);
  const [setupRequired, setSetupRequired] = useState<{ missing?: string[] } | null>(null);
  const [pendingApply, setPendingApply] = useState<null | { proposalId: string }>(null);
  const [pendingUndo, setPendingUndo] = useState<null | { changeId: string }>(null);
  const [appliedChange, setAppliedChange] = useState<AppliedChange | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const ai = useAiAssistant();

  // Fetch active strategy for this client
  const { data: strategies = [] } = useStrategies(clientId);
  const activeStrategy = strategies[0];
  const strategyId = activeStrategy?.id ?? '';

  // Fetch history and tasks
  const { data: history = [], isLoading: historyLoading } = useStrategyHistory(clientId, strategyId, 100);
  const { data: tasks = [], isLoading: tasksLoading } = useStrategyTasks(clientId, strategyId);
  const updateStatus = useUpdateTaskStatus();
  const { data: strategyModules = [] } = useStrategyModules(clientId, strategyId);
  const updateContent = useUpdateModuleContent();
  const addHistoryEvent = useAddHistoryEvent();

  const groupedHistory = groupHistoryByDate(history);
  const taskCounts = getTaskCounts(tasks);

  const modulesByKey = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of strategyModules ?? []) map.set(m.module, m);
    return map;
  }, [strategyModules]);

  const proposals = useMemo(() => {
    const raw = Array.isArray(lastProposals) ? lastProposals : [];
    return raw
      .filter((p) => p && typeof p === 'object')
      .map((p: any) => {
        const module = String(p.module ?? '');
        if (!isStrategyModule(module)) return null;
        return {
          id: String(p.id ?? ''),
          module,
          title: String(p.title ?? ''),
          summary: String(p.summary ?? ''),
          proposed_content_json: (p.proposed_content_json ?? {}) as Record<string, unknown>,
          risks: Array.isArray(p.risks) ? (p.risks as string[]) : undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => !!p && !!p.id);
  }, [lastProposals]);

  const lastAssistantChange = useMemo(() => {
    for (const event of history) {
      const data = event.event_data ?? {};
      const source = data.source as string | undefined;
      if (source !== 'ai_assistant') continue;
      if (data.agent_revert_of) continue;
      if (!data.before_content_json || !data.after_content_json) continue;
      if (!event.module || !event.module_id) continue;
      return {
        module: event.module as StrategyModule,
        moduleId: event.module_id,
        before: data.before_content_json as Record<string, unknown>,
        after: data.after_content_json as Record<string, unknown>,
        changeId: (data.agent_change_id as string | undefined) ?? null,
      };
    }
    return null;
  }, [history]);

  useEffect(() => {
    if (!open) return;
    if (panelTab !== 'ai') return;
    if (!clientId) return;
    if (ai.isPending) return;

    // Load persisted chat when opening AI tab (once per open).
    if (messages.length > 1) return;

    (async () => {
      try {
        setIsLoading(true);
        setSetupRequired(null);
        const data = (await ai.mutateAsync({
          action: 'load',
          clientId,
          strategyId: strategyId || null,
          activeTab: null,
          threadId,
        })) as any;

        if (data?.thread_id) setThreadId(String(data.thread_id));
        const loaded = Array.isArray(data?.messages) ? (data.messages as Array<{ role: string; content: string }>) : [];
        if (loaded.length === 0) return;

        setMessages(
          loaded.map((m, idx) => ({
            id: `m-${idx}`,
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m.content ?? ''),
            timestamp: new Date(),
          }))
        );
      } catch (error) {
        if (error instanceof AiAssistantError && error.code === 'AI_SETUP_REQUIRED') {
          setSetupRequired({ missing: error.missing });
        } else {
          const message = error instanceof Error ? error.message : 'Failed to load chat';
          toast.error(message);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [open, panelTab, clientId, strategyId, threadId, ai, messages.length]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (setupRequired) return;

    const userMessage: ChatMessage = {
      id: safeUuid(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = [...messages, userMessage]
        .filter((m) => m.id !== 'welcome')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const data = (await ai.mutateAsync({
        action: 'send',
        clientId,
        strategyId: strategyId || null,
        activeTab: null,
        threadId,
        message: userMessage.content,
        chatHistory,
      })) as any;

      if (data?.thread_id) setThreadId(String(data.thread_id));
      const assistantText = String(data?.assistant_message ?? '').trim();
      setLastProposals(Array.isArray(data?.json?.proposals) ? data.json.proposals : []);

      setMessages((prev) => [
        ...prev,
        {
          id: safeUuid(),
          role: 'assistant',
          content: assistantText || "I didn't get a response. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      if (error instanceof AiAssistantError && error.code === 'AI_SETUP_REQUIRED') {
        setSetupRequired({ missing: error.missing });
      } else {
        const message = error instanceof Error ? error.message : 'AI request failed';
        setMessages((prev) => [
          ...prev,
          { id: safeUuid(), role: 'assistant', content: `Error: ${message}`, timestamp: new Date() },
        ]);
      }
    } finally {
      setIsLoading(false);
      queueMicrotask(() => inputRef.current?.focus());
    }

    return;

    // Simulate AI response (in production, this would call an edge function)
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you want help with: "${userMessage.content}".

AI isn’t configured yet. Complete AI Setup to enable this assistant.`,
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

  const applyProposal = async (proposalId: string) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) return;

    if (!strategyId) {
      toast.error('No active strategy found');
      return;
    }

    const moduleRecord = modulesByKey.get(proposal.module);
    if (!moduleRecord?.id) {
      toast.error('Missing module record');
      return;
    }

    if (moduleRecord.locked) {
      toast.error('Module is locked');
      return;
    }

    const before = (moduleRecord.content_json ?? {}) as Record<string, unknown>;
    const after = proposal.proposed_content_json ?? {};

    const moduleMap = Object.fromEntries((strategyModules ?? []).map((m: any) => [m.module, m.content_json]));
    moduleMap[proposal.module] = after;

    const changeId = safeUuid();

    await updateContent.mutateAsync({
      moduleId: moduleRecord.id,
      clientId,
      module: proposal.module,
      contentJson: after,
      modules: moduleMap,
      currentStatus: moduleRecord.status,
      isLocked: false,
    });

    await addHistoryEvent.mutateAsync({
      clientId,
      strategyId,
      moduleId: moduleRecord.id,
      module: proposal.module,
      eventType: 'updated',
      eventData: {
        source: 'ai_assistant',
        agent_change_id: changeId,
        proposal: {
          id: proposal.id,
          title: proposal.title,
          summary: proposal.summary,
          risks: proposal.risks ?? [],
        },
        before_content_json: before,
        after_content_json: after,
      },
    });

    setAppliedChange({
      id: changeId,
      appliedAt: Date.now(),
      changes: [{ module: proposal.module, moduleId: moduleRecord.id, before, after }],
    });

    toast.success('Change applied', { description: proposal.title });
  };

  const undoLastChange = async () => {
    if (!appliedChange) return;
    if (!strategyId) return;

    const changeId = appliedChange.id;
    for (const change of appliedChange.changes) {
      const moduleRecord = modulesByKey.get(change.module);
      if (!moduleRecord?.id) continue;
      if (moduleRecord.locked) continue;

      const moduleMap = Object.fromEntries((strategyModules ?? []).map((m: any) => [m.module, m.content_json]));
      moduleMap[change.module] = change.before;

      await updateContent.mutateAsync({
        moduleId: moduleRecord.id,
        clientId,
        module: change.module,
        contentJson: change.before,
        modules: moduleMap,
        currentStatus: moduleRecord.status,
        isLocked: false,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: moduleRecord.id,
        module: change.module,
        eventType: 'updated',
        eventData: {
          source: 'ai_assistant',
          agent_revert_of: changeId,
          before_content_json: change.after,
          after_content_json: change.before,
        },
      });
    }

    setAppliedChange(null);
    toast.success('Reverted last change');
  };

  const undoHistoricalChange = async () => {
    if (!lastAssistantChange) return;
    if (!strategyId) return;

    const moduleRecord = modulesByKey.get(lastAssistantChange.module);
    if (!moduleRecord?.id) {
      toast.error('Missing module record');
      return;
    }

    if (moduleRecord.locked) {
      toast.error('Module is locked');
      return;
    }

    const moduleMap = Object.fromEntries((strategyModules ?? []).map((m: any) => [m.module, m.content_json]));
    moduleMap[lastAssistantChange.module] = lastAssistantChange.before;

    await updateContent.mutateAsync({
      moduleId: moduleRecord.id,
      clientId,
      module: lastAssistantChange.module,
      contentJson: lastAssistantChange.before,
      modules: moduleMap,
      currentStatus: moduleRecord.status,
      isLocked: false,
    });

    await addHistoryEvent.mutateAsync({
      clientId,
      strategyId,
      moduleId: moduleRecord.id,
      module: lastAssistantChange.module,
      eventType: 'updated',
      eventData: {
        source: 'ai_assistant',
        agent_revert_of: lastAssistantChange.changeId ?? 'unknown',
        before_content_json: lastAssistantChange.after,
        after_content_json: lastAssistantChange.before,
      },
    });

    toast.success('Reverted previous assistant change');
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
        className="w-full sm:w-[400px] md:w-[450px] p-0 flex flex-col [&>button]:hidden"
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
                    {setupRequired && (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                        <div className="text-sm font-semibold">AI Assistant setup required</div>
                        <p className="text-xs text-muted-foreground">
                          Complete AI Setup to enable this assistant.
                          {Array.isArray(setupRequired.missing) && setupRequired.missing.length > 0
                            ? ` Missing: ${setupRequired.missing.join(', ')}.`
                            : ''}
                        </p>
                        <Button size="sm" asChild>
                          <Link to="/agency/ai-setup">Complete AI Setup</Link>
                        </Button>
                      </div>
                    )}
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

                    {proposals.length > 0 && (
                      <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <Wand2 className="h-4 w-4" />
                          Proposed changes
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Nothing changes until you approve. Locked modules are protected.
                        </div>
                        <div className="space-y-2">
                          {proposals.map((p) => {
                            const moduleRecord = modulesByKey.get(p.module);
                            const locked = !!moduleRecord?.locked;
                            return (
                              <div key={p.id} className="rounded-md border bg-background/40 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-medium">{p.title}</div>
                                      <Badge variant="outline" className="text-xs">
                                        {p.module}
                                      </Badge>
                                      {locked && (
                                        <Badge variant="secondary" className="gap-1 text-xs">
                                          <Lock className="h-3 w-3" />
                                          Locked
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">{p.summary}</div>
                                    {Array.isArray(p.risks) && p.risks.length > 0 && (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        <span className="font-medium">Risks:</span> {p.risks.join(' • ')}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      disabled={locked || updateContent.isPending}
                                      onClick={() => setPendingApply({ proposalId: p.id })}
                                    >
                                      Apply
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(appliedChange || lastAssistantChange) && (
                      <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <Undo2 className="h-4 w-4" />
                          Undo available
                        </div>
                        <div className="text-xs text-muted-foreground">
                          You can revert the most recent assistant-applied Strategy change.
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() =>
                            setPendingUndo({ changeId: appliedChange?.id ?? lastAssistantChange?.changeId ?? 'history' })
                          }
                          disabled={updateContent.isPending || !strategyId}
                        >
                          Undo most recent assistant change
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-3 border-t space-y-2">
                  <div className="flex gap-2">
                    <Textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={setupRequired ? 'Complete AI Setup to enable chat…' : 'Ask about this client, brainstorm, or request Strategy edits…'}
                      className="min-h-[60px] resize-none text-sm"
                      disabled={isLoading || !!setupRequired}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading || !!setupRequired}
                      size="icon"
                      className="h-auto"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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

      <AlertDialog open={!!pendingApply} onOpenChange={(v) => !v && setPendingApply(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this change?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the selected Strategy module. You can undo after applying.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const id = pendingApply?.proposalId;
                setPendingApply(null);
                if (!id) return;
                try {
                  await applyProposal(id);
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Apply failed';
                  toast.error(message);
                }
              }}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingUndo} onOpenChange={(v) => !v && setPendingUndo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo last assistant change?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revert the previous module edits applied by the assistant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setPendingUndo(null);
                try {
                  if (appliedChange) {
                    await undoLastChange();
                  } else if (lastAssistantChange) {
                    await undoHistoricalChange();
                  } else {
                    toast.error('No change found to undo');
                  }
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Undo failed';
                  toast.error(message);
                }
              }}
            >
              Undo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
