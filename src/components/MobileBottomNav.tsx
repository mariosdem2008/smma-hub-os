import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Brain, Home, Settings, Users } from "lucide-react";
import { hapticSelection } from "@/lib/haptics";

const navItems = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/agency/ai-setup", label: "AI Setup", icon: Brain },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function MobileBottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/90 shadow-panel backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="grid h-16 grid-cols-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => hapticSelection()}
              className={cn(
                "focus-ring flex flex-col items-center justify-center gap-1 rounded-lg transition-colors touch-manipulation",
                "active:scale-95 active:opacity-70 transition-transform duration-100",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              style={{ minHeight: "44px", minWidth: "44px" }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
