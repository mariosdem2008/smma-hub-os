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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="grid grid-cols-6 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={`${basePortalPath}/${item.path}`}
              onClick={() => hapticSelection()}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors touch-manipulation",
                "active:scale-95 active:opacity-70 transition-transform duration-100",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              style={{ minHeight: "44px", minWidth: "44px" }}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
