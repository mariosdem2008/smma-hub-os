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
    if (conf >= 85) return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (conf >= 70) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
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
