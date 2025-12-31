// Strategy OS - Module Status Badge

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getStatusDefinition } from '@/lib/strategy/constants';
import type { StrategyStatus } from '@/lib/strategy/types';
import { FileEdit, Eye, CheckCircle, Lock } from 'lucide-react';

interface ModuleStatusBadgeProps {
  status: StrategyStatus;
  className?: string;
  showIcon?: boolean;
}

const statusIcons: Record<StrategyStatus, typeof FileEdit | null> = {
  empty: null,
  draft: FileEdit,
  review: Eye,
  approved: CheckCircle,
  locked: Lock,
};

export function ModuleStatusBadge({ status, className, showIcon = true }: ModuleStatusBadgeProps) {
  const statusDef = getStatusDefinition(status);
  const Icon = statusIcons[status];

  if (!statusDef) return null;

  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-xs font-medium',
        statusDef.bgColor,
        statusDef.color,
        statusDef.borderColor,
        'border',
        className
      )}
    >
      {showIcon && Icon && <Icon className="mr-1 h-3 w-3" />}
      {statusDef.label}
    </Badge>
  );
}

export default ModuleStatusBadge;
