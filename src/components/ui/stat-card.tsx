import { LucideIcon } from "lucide-react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "orange" | "teal" | "purple" | "green";
  className?: string;
}

const variantStyles = {
  default: "from-[#4E5DFF] to-[#6A73FF]",
  orange: "from-[hsl(25,95%,60%)] to-[hsl(35,95%,65%)]",
  teal: "from-[hsl(180,85%,55%)] to-[hsl(190,85%,60%)]",
  purple: "from-[hsl(270,75%,65%)] to-[hsl(280,75%,70%)]",
  green: "from-[hsl(150,70%,55%)] to-[hsl(160,70%,60%)]",
};

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  variant = "default",
  className 
}: StatCardProps) {
  return (
    <Card className={cn("p-6 hover:shadow-lg transition-all duration-200", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className={cn(
          "rounded-xl p-3 bg-gradient-to-br shadow-lg",
          variantStyles[variant]
        )}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </Card>
  );
}
