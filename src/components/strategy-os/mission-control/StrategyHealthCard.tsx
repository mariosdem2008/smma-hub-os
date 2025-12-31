// Strategy OS - Strategy Health Card

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

interface StrategyHealthCardProps {
  completion: number;
  modulesCount: number;
  blockersCount: number;
}

export function StrategyHealthCard({
  completion,
  modulesCount,
  blockersCount,
}: StrategyHealthCardProps) {
  const getHealthStatus = () => {
    if (completion >= 80) return { label: 'Healthy', color: 'text-green-400', icon: CheckCircle2 };
    if (completion >= 50) return { label: 'In Progress', color: 'text-yellow-400', icon: Sparkles };
    return { label: 'Needs Attention', color: 'text-orange-400', icon: AlertTriangle };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/20">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Strategy Completion</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{completion}%</span>
              <span className={cn('text-sm font-medium', health.color)}>
                {health.label}
              </span>
            </div>
          </div>
          <div className={cn('rounded-full p-2', health.color, 'bg-current/10')}>
            <HealthIcon className={cn('h-5 w-5', health.color)} />
          </div>
        </div>

        <Progress value={completion} className="h-2 mb-4" />

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
          <div>
            <p className="text-2xl font-semibold">{modulesCount}</p>
            <p className="text-xs text-muted-foreground">Total Modules</p>
          </div>
          <div>
            <p className={cn('text-2xl font-semibold', blockersCount > 0 && 'text-orange-400')}>
              {blockersCount}
            </p>
            <p className="text-xs text-muted-foreground">Blockers</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StrategyHealthCard;
