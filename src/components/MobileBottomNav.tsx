import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Users, CheckSquare, Settings } from "lucide-react";
import { hapticSelection } from "@/lib/haptics";

const navItems = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/tasks", label: "Tasks", icon: CheckSquare },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
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
