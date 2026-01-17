import {
  LayoutDashboard,
  Users,
  UsersRound,
  Settings,
  LogOut,
  CreditCard,
  Bot,
  Brain,
  ArrowUpCircle /*MessageSquare*/,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useRole } from "@/hooks/useRole";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Team", url: "/team", icon: UsersRound },
  { title: "Settings", url: "/settings", icon: Settings },
];

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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={`
                          relative transition-all duration-200 hover:bg-card/70
                          ${active ? "bg-card text-foreground" : ""}
                        `}
                        activeClassName="bg-card text-foreground font-medium"
                      >
                        {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-full" />}
                        <item.icon
                          className={`
                          h-4 w-4 ml-1 transition-all duration-200
                          ${active ? "text-primary" : "text-muted-foreground hover:text-primary hover:scale-[1.03]"}
                        `}
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
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg"
              >
                <ArrowUpCircle className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2 font-semibold">Upgrade</span>}
              </Button>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1">
          <Button variant="ghost" className="flex-1 justify-start hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
