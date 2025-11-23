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

const iconBackgrounds = [
  "bg-gradient-orange",
  "bg-gradient-teal",
  "bg-gradient-purple",
  "bg-gradient-green",
];

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  const randomBg = iconBackgrounds[Math.floor(Math.random() * iconBackgrounds.length)];
  
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className={cn("rounded-full p-6 mb-6", randomBg)}>
        <Icon className="h-12 w-12 text-white" />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
