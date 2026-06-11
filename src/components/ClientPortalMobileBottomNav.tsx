import { Link, useLocation, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CheckCircle, CalendarDays, Upload, MessageSquare, BarChart3, Bot } from "lucide-react";
import { hapticSelection } from "@/lib/haptics";

export function ClientPortalMobileBottomNav() {
  const location = useLocation();
  const { portalSlug } = useParams();
  const basePortalPath = portalSlug ? `/client/portal/${portalSlug}` : "/client/portal";

  const navItems = [
    { path: "approvals", label: "Approve", icon: CheckCircle },
    { path: "content-calendar", label: "Calendar", icon: CalendarDays },
    { path: "performance", label: "Stats", icon: BarChart3 },
    { path: "messages", label: "Messages", icon: MessageSquare },
    { path: "ai-assistant", label: "AI", icon: Bot },
    { path: "uploads", label: "Upload", icon: Upload },
  ];

  const isActive = (path: string) => {
    return location.pathname.includes(`/${path}`);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/92 shadow-panel backdrop-blur-xl safe-area-bottom md:hidden">
      <div className="grid h-16 grid-cols-6 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={`${basePortalPath}/${item.path}`}
              onClick={() => hapticSelection()}
              className={cn(
                "focus-ring touch-manipulation my-1 flex flex-col items-center justify-center gap-1 rounded-lg transition-all",
                "active:scale-[0.98] active:opacity-80",
                active
                  ? "bg-primary text-primary-foreground shadow-btn-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={{ minHeight: "44px", minWidth: "44px" }}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
