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
  default: "from-[hsl(172,72%,44%)] to-[hsl(196,92%,58%)]",
  orange: "from-[hsl(25,95%,60%)] to-[hsl(35,95%,65%)]",
  teal: "from-[hsl(180,85%,55%)] to-[hsl(190,85%,60%)]",
  purple: "from-[hsl(172,72%,44%)] to-[hsl(196,92%,58%)]",
  green: "from-[hsl(150,70%,55%)] to-[hsl(160,70%,60%)]",
};

export function StatCard({ title, value, icon: Icon, description, variant = "default", className }: StatCardProps) {
  const isMobile = useIsMobile();

  return (
    <Card className={cn("py-4 md:py-6 hover:shadow-lg transition-all duration-200", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 md:space-y-2 flex-1">
          <p className="text-xs md:text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl md:text-3xl font-bold">{value}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className={cn("rounded-lg md:rounded-xl p-2 md:p-3 bg-gradient-to-br shadow-lg", variantStyles[variant])}>
          <Icon className={isMobile ? "h-5 w-5 text-white" : "h-6 w-6 text-white"} />
        </div>
      </div>
    </Card>
  );
}
