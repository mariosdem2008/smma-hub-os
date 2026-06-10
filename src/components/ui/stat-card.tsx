import { LucideIcon } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "orange" | "teal" | "purple" | "green";
  className?: string;
}

const variantStyles = {
  default: "border-primary/20 bg-primary/10 text-primary",
  orange: "border-warning/20 bg-warning/10 text-warning",
  teal: "border-accent/20 bg-accent/10 text-accent",
  purple: "border-primary/20 bg-primary/10 text-primary",
  green: "border-success/20 bg-success/10 text-success",
};

export function StatCard({ title, value, icon: Icon, description, variant = "default", className }: StatCardProps) {
  const isMobile = useIsMobile();

  return (
    <Card className={cn("py-4 transition-colors duration-200 md:py-6", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 md:space-y-2 flex-1">
          <p className="text-xs md:text-sm text-muted-foreground font-medium">{title}</p>
          <p className="metric-number text-2xl font-bold md:text-3xl">{value}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className={cn("rounded-lg border p-2 md:p-3", variantStyles[variant])}>
          <Icon className={isMobile ? "h-5 w-5" : "h-6 w-6"} />
        </div>
      </div>
    </Card>
  );
}
