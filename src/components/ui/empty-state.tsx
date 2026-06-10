import { LucideIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-12 text-center",
        className,
      )}
    >
      <div className="mb-5 rounded-lg border border-primary/20 bg-primary/10 p-4 text-primary">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mb-2 font-display text-xl font-semibold text-foreground">{title}</h3>
      <p className="mb-6 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
