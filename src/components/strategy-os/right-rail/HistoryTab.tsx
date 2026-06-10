// Strategy OS - History Tab

import { useStrategyOS } from '../StrategyOSContext';
import { useStrategyHistory, groupHistoryByDate, formatHistoryEvent } from '@/hooks/useStrategyHistory';
import { HISTORY_EVENT_LABELS, getModuleDefinition } from '@/lib/strategy/constants';
import type { HistoryEventType } from '@/lib/strategy/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  FileEdit,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle,
  ListTodo,
  ArrowRight,
  Clock,
} from 'lucide-react';

const eventIcons: Record<HistoryEventType, typeof FileEdit> = {
  created: FileEdit,
  updated: FileEdit,
  locked: Lock,
  unlocked: Unlock,
  seeded: Sparkles,
  approved: CheckCircle,
  task_generated: ListTodo,
  task_pushed: ArrowRight,
};

export function HistoryTab() {
  const { clientId, strategyId } = useStrategyOS();
  const { data: history = [], isLoading } = useStrategyHistory(clientId, strategyId, 100);

  const groupedHistory = groupHistoryByDate(history);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm text-muted-foreground">Loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center px-4">
        <Clock className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No history yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Events will appear here as you work on your strategy
        </p>
      </div>
    );
  }

  return (
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
                        eventType === 'seeded' && 'bg-primary/10 text-primary',
                        eventType === 'locked' && 'bg-destructive/10 text-destructive',
                        eventType === 'unlocked' && 'bg-success/10 text-success',
                        eventType === 'approved' && 'bg-success/10 text-success',
                        eventType === 'updated' && 'bg-primary/10 text-primary',
                        eventType === 'created' && 'bg-primary/10 text-primary',
                        (eventType === 'task_generated' || eventType === 'task_pushed') &&
                          'bg-warning/10 text-warning'
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
  );
}

export default HistoryTab;
