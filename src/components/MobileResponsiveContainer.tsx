import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container that adapts padding and spacing for mobile screens
 */
export function MobileResponsiveContainer({ children, className }: MobileResponsiveContainerProps) {
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      isMobile ? "p-3 space-y-3" : "p-6 space-y-6",
      className
    )}>
      {children}
    </div>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: {
    mobile?: number;
    desktop?: number;
  };
  className?: string;
}

/**
 * Responsive grid that adapts to screen size
 */
export function ResponsiveGrid({ 
  children, 
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = { mobile: 3, desktop: 4 },
  className 
}: ResponsiveGridProps) {
  return (
    <div 
      className={cn(
        "grid",
        `grid-cols-${columns.mobile || 1}`,
        `sm:grid-cols-${columns.tablet || 2}`,
        `lg:grid-cols-${columns.desktop || 3}`,
        `gap-${gap.mobile || 3}`,
        `md:gap-${gap.desktop || 4}`,
        className
      )}
    >
      {children}
    </div>
  );
}
