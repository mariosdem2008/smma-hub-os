import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

interface ClientTabEmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export default function ClientTabEmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: ClientTabEmptyStateProps) {
  return (
    <Card className={cn("border-dashed bg-card/80", className)}>
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        {icon && (
          <div className="mb-5 rounded-lg border border-primary/20 bg-primary/10 p-4 text-primary">
            {icon}
          </div>
        )}

        <h3 className="mb-2 font-display text-xl font-semibold text-foreground">{title}</h3>

        {description && (
          <p className="mb-6 max-w-md text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}

        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {primaryAction && (
              <Button
                onClick={primaryAction.onClick}
                variant={primaryAction.variant ?? "default"}
              >
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                onClick={secondaryAction.onClick}
                variant={secondaryAction.variant ?? "outline"}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
