// ============================================================================
// Step Layout Component
// Common layout wrapper for each onboarding step
// ============================================================================

import { type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepLayoutProps {
  /** Step title (the question) */
  title: string;
  /** Optional description/hint */
  description?: string;
  /** Current step number (1-indexed) */
  stepNumber: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether user can go back */
  canGoBack?: boolean;
  /** Whether user can proceed */
  canProceed?: boolean;
  /** Whether the step is saving */
  isSaving?: boolean;
  /** Callback when back is clicked */
  onBack?: () => void;
  /** Callback when next is clicked */
  onNext?: () => void;
  /** Custom next button text */
  nextButtonText?: string;
  /** Custom back button text */
  backButtonText?: string;
  /** Hide navigation buttons */
  hideNavigation?: boolean;
  /** Additional content for footer */
  footerContent?: ReactNode;
  /** Children (the step content) */
  children: ReactNode;
  /** Additional class name */
  className?: string;
}

export function StepLayout({
  title,
  description,
  stepNumber,
  totalSteps,
  canGoBack = true,
  canProceed = true,
  isSaving = false,
  onBack,
  onNext,
  nextButtonText = 'Next',
  backButtonText = 'Back',
  hideNavigation = false,
  footerContent,
  children,
  className,
}: StepLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Step header */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Step {stepNumber} of {totalSteps}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          {children}
        </CardContent>
      </Card>

      {/* Navigation */}
      {!hideNavigation && (
        <div className="flex items-center justify-between">
          <div>
            {canGoBack && stepNumber > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={isSaving}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {backButtonText}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {footerContent}
            <Button
              type="button"
              onClick={onNext}
              disabled={!canProceed || isSaving}
              size="lg"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {nextButtonText}
              {!isSaving && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Step Section Component
// For grouping related fields within a step
// ============================================================================

interface StepSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function StepSection({
  title,
  description,
  children,
  className,
}: StepSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="font-medium">{title}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ============================================================================
// Step Field Component
// For individual form fields with labels
// ============================================================================

interface StepFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function StepField({
  label,
  required = false,
  hint,
  error,
  children,
  className,
}: StepFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
