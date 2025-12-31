// Strategy OS - Tasks Tab

import { useState } from 'react';
import { useStrategyOS, useCurrentModule } from '../StrategyOSContext';
import {
  useStrategyTasks,
  useCreateTask,
  useUpdateTaskStatus,
  useDeleteTask,
  useGenerateTasksFromModule,
  usePushTaskToPipeline,
  getTaskCounts,
} from '@/hooks/useStrategyTasks';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import { TASK_PRIORITY_CONFIG } from '@/lib/strategy/constants';
import type { TaskStatus, TaskPriority, StrategyModule } from '@/lib/strategy/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus,
  ListTodo,
  Sparkles,
  ArrowRight,
  MoreVertical,
  CheckCircle,
  Circle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TasksTab() {
  const { clientId, agencyId, strategyId, activeView, modules } = useStrategyOS();
  const navigate = useNavigate();
  const currentModule = useCurrentModule();
  const { data: tasks = [], isLoading } = useStrategyTasks(clientId, strategyId);
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const generateTasks = useGenerateTasksFromModule();
  const pushToPipeline = usePushTaskToPipeline();
  const addHistoryEvent = useAddHistoryEvent();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Filter tasks for current module if viewing a module
  const filteredTasks =
    activeView === 'mission-control'
      ? tasks
      : tasks.filter((t) => t.module === activeView);

  const taskCounts = getTaskCounts(filteredTasks);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      await createTask.mutateAsync({
        clientId,
        agencyId,
        strategyId,
        moduleId: currentModule?.id,
        module: activeView === 'mission-control' ? undefined : activeView,
        title: newTaskTitle.trim(),
      });
      if (currentModule) {
        await addHistoryEvent.mutateAsync({
          clientId,
          strategyId,
          moduleId: currentModule.id,
          module: currentModule.module,
          eventType: 'task_created',
          eventData: { title: newTaskTitle.trim() },
        });
      }
      setNewTaskTitle('');
      setIsCreating(false);
      toast.success('Task created');
    } catch (err) {
      toast.error('Failed to create task');
    }
  };

  const handleGenerateTasks = async () => {
    if (!currentModule) {
      toast.error('Select a module to generate tasks');
      return;
    }

    try {
      const results = await generateTasks.mutateAsync({
        clientId,
        agencyId,
        strategyId,
        moduleId: currentModule.id,
        module: currentModule.module,
        content: currentModule.content_json,
      });

      await addHistoryEvent.mutateAsync({
        clientId,
        strategyId,
        moduleId: currentModule.id,
        module: currentModule.module,
        eventType: 'task_generated',
        eventData: { count: results.length },
      });

      toast.success(`Generated ${results.length} tasks`);
    } catch (err) {
      toast.error('Failed to generate tasks');
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateStatus.mutateAsync({ taskId, clientId, strategyId, status });
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync({ taskId, clientId, strategyId });
      toast.success('Task deleted');
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const handlePushToPipeline = async (taskId: string, moduleKey?: StrategyModule | null) => {
    try {
      const moduleContent =
        currentModule?.content_json ??
        modules.find((mod) => mod.module === moduleKey)?.content_json;
      await pushToPipeline.mutateAsync({
        taskId,
        clientId,
        strategyId,
        agencyId,
        moduleContent,
      });

      if (currentModule) {
        await addHistoryEvent.mutateAsync({
          clientId,
          strategyId,
          moduleId: currentModule.id,
          module: currentModule.module,
          eventType: 'task_pushed',
        });
      }

      toast.success('Task pushed to pipeline');
    } catch (err) {
      toast.error('Failed to push task');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with counts */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm">Tasks</h3>
          <Badge variant="secondary" className="text-xs">
            {filteredTasks.length} total
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

      {/* Actions */}
      <div className="p-3 border-b border-border/50 space-y-2">
        {activeView !== 'mission-control' && currentModule && (
          <Button
            onClick={handleGenerateTasks}
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={generateTasks.isPending}
          >
            {generateTasks.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Tasks from Module
          </Button>
        )}

        {isCreating ? (
          <div className="flex gap-2">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title..."
              className="text-sm h-8"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
              autoFocus
            />
            <Button onClick={handleCreateTask} size="sm" disabled={!newTaskTitle.trim()}>
              Add
            </Button>
            <Button onClick={() => setIsCreating(false)} size="sm" variant="ghost">
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setIsCreating(true)}
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-muted-foreground"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        )}
      </div>

      {/* Task List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center">
              <ListTodo className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">No tasks yet</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
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

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
        {task.status !== 'pushed' && (
          <DropdownMenuItem onClick={() => handlePushToPipeline(task.id, task.module)}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Push to Pipeline
          </DropdownMenuItem>
        )}
        {task.project_id && (
          <DropdownMenuItem onClick={() => navigate(`/clients/${clientId}?tab=pipeline&projectId=${task.project_id}`)}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Open in Pipeline
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => handleDelete(task.id)}
          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default TasksTab;
