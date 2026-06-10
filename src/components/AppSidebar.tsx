import {
  LayoutDashboard,
  Users,
  UsersRound,
  Settings,
  LogOut,
  CreditCard,
  Bot,
  Brain,
  ArrowUpCircle,
  Layers3,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useRole } from "@/hooks/useRole";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const { subscription } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const { role, isOwner, isAdmin } = useRole();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const isCollapsed = state === "collapsed";

  // Show upgrade button for free, starter, and LTD starter users
  const showUpgradeButton = subscription && ["free", "starter", "ltd_starter"].includes(subscription.plan_type);

  // Dynamic navigation items based on role
  const navigationItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Clients", url: "/clients", icon: Users },
    //    { title: "Messages", url: "/messages", icon: MessageSquare },
    { title: "Team", url: "/team", icon: UsersRound },
    ...(isAdmin ? [{ title: "Agency AI", url: "/ai/admin", icon: Bot }] : []),
    { title: "AI Setup", url: "/agency/ai-setup", icon: Brain },
    // Billing: Show different links based on role
    ...(isOwner
      ? [{ title: "Billing", url: "/billing", icon: CreditCard }]
      : isAdmin
        ? [{ title: "Billing", url: "/billing/overview", icon: CreditCard }]
        : []),
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3 rounded-lg border border-sidebar-border/80 bg-sidebar-accent/50 p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Layers3 className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-bold text-sidebar-foreground">SMMAHUB</div>
              <div className="truncate text-xs text-sidebar-foreground/60">Agency control layer</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className="relative min-h-9 text-sidebar-foreground/75 hover:text-sidebar-foreground"
                        activeClassName="text-sidebar-foreground"
                      >
                        {active && <div className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-sidebar-primary" />}
                        <item.icon
                          className={`ml-1 h-4 w-4 transition-colors duration-200 ${
                            active ? "text-sidebar-primary" : "text-sidebar-foreground/50"
                          }`}
                        />
                        {!isCollapsed && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Upgrade CTA */}
        {showUpgradeButton && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <Button
                onClick={() => openUpgradeModal()}
                className="w-full"
              >
                <ArrowUpCircle className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2 font-semibold">Upgrade</span>}
              </Button>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2">
          <Button variant="ghost" className="flex-1 justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Sign out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
