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
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {icon && (
          <div className="mb-4 text-muted-foreground">
            {icon}
          </div>
        )}

        <h3 className="text-lg font-semibold mb-2">{title}</h3>

        {description && (
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {description}
          </p>
        )}

        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:flex-row items-center gap-3">
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
