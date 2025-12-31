// ============================================================================
// Readiness Meter Component
// Displays the Strategy Readiness score (0-100) with visual indicator
// ============================================================================

import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getReadinessLevel } from '@/lib/onboarding/readiness';

interface ReadinessMeterProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ReadinessMeter({
  score,
  showLabel = true,
  size = 'md',
  className,
}: ReadinessMeterProps) {
  const level = useMemo(() => getReadinessLevel(score), [score]);

  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className={cn('flex items-center justify-between mb-1.5', textSizeClasses[size])}>
          <span className="text-muted-foreground">Strategy Readiness</span>
          <span className={cn('font-semibold', {
            'text-red-500': level.color === 'red',
            'text-yellow-500': level.color === 'yellow',
            'text-green-500': level.color === 'green',
          })}>
            {score}% {level.label}
          </span>
        </div>
      )}
      <div className={cn('relative w-full rounded-full bg-secondary overflow-hidden', sizeClasses[size])}>
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out rounded-full',
            colorClasses[level.color]
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && size !== 'sm' && (
        <p className="text-xs text-muted-foreground mt-1">{level.description}</p>
      )}
    </div>
  );
}

// ============================================================================
// Circular Readiness Meter (alternative display)
// ============================================================================

interface CircularReadinessMeterProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

export function CircularReadinessMeter({
  score,
  size = 120,
  strokeWidth = 8,
  showLabel = true,
  className,
}: CircularReadinessMeterProps) {
  const level = useMemo(() => getReadinessLevel(score), [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const colorClasses = {
    red: 'stroke-red-500',
    yellow: 'stroke-yellow-500',
    green: 'stroke-green-500',
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-secondary"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-700 ease-out', colorClasses[level.color])}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold', {
            'text-red-500': level.color === 'red',
            'text-yellow-500': level.color === 'yellow',
            'text-green-500': level.color === 'green',
          })}>
            {score}%
          </span>
          <span className="text-xs text-muted-foreground">{level.label}</span>
        </div>
      )}
    </div>
  );
}
