// Strategy OS - AI Confidence Badge

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface AIConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

export function AIConfidenceBadge({ confidence, className }: AIConfidenceBadgeProps) {
  const getConfidenceColor = (conf: number) => {
    if (conf >= 85) return 'text-success bg-success/10 border-success/30';
    if (conf >= 70) return 'text-warning bg-warning/10 border-warning/30';
    return 'text-warning bg-warning/10 border-warning/30';
  };

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 85) return 'High';
    if (conf >= 70) return 'Medium';
    return 'Low';
  };

  return (
    <Badge
      variant="secondary"
      className={cn('text-xs font-medium border gap-1', getConfidenceColor(confidence), className)}
    >
      <Sparkles className="h-3 w-3" />
      AI {confidence}% ({getConfidenceLabel(confidence)})
    </Badge>
  );
}

export default AIConfidenceBadge;
