import type { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PremiumPageProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PremiumPage({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PremiumPageProps) {
  return (
    <div className={cn("space-y-5 md:space-y-6", className)}>
      <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-card/80 p-4 shadow-card md:flex-row md:items-start md:justify-between md:p-5">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
          <h1 className="font-display text-2xl font-bold leading-tight text-foreground md:text-3xl">{title}</h1>
          {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn("space-y-5 md:space-y-6", contentClassName)}>{children}</div>
    </div>
  );
}

interface PremiumStatCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning" | "destructive" | "muted";
  className?: string;
}

const statToneClass: Record<NonNullable<PremiumStatCardProps["tone"]>, string> = {
  primary: "border-primary/25 bg-primary/10 text-primary",
  accent: "border-accent/25 bg-accent/10 text-accent",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/50 text-muted-foreground",
};

export function PremiumStatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "primary",
  className,
}: PremiumStatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-label uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="metric-number text-2xl font-bold text-foreground md:text-3xl">{value}</div>
            {detail ? <div className="text-xs leading-5 text-muted-foreground">{detail}</div> : null}
          </div>
          <div className={cn("rounded-lg border p-2.5", statToneClass[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PremiumLoadingProps {
  rows?: number;
  className?: string;
}

export function PremiumLoading({ rows = 3, className }: PremiumLoadingProps) {
  return (
    <div className={cn("space-y-4", className)} aria-label="Loading">
      <Skeleton className="h-28 w-full" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}

interface PremiumInlineEmptyProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function PremiumInlineEmpty({ icon: Icon, title, description, className }: PremiumInlineEmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-10 text-center",
        className,
      )}
    >
      <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 p-3 text-primary">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
