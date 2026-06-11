import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useUpgradeAssistantTriggers } from "@/hooks/useUpgradeAssistantTriggers";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, UserPlus } from "lucide-react";
import { InviteTeamMemberDialog } from "./InviteTeamMemberDialog";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";

const pageLabels: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  messages: "Messages",
  team: "Team",
  billing: "Billing",
  settings: "Settings",
  agency: "Agency",
  "ai-setup": "AI Setup",
  ai: "AI",
  admin: "Admin",
};

function getCrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["Dashboard"];
  return segments.slice(0, 3).map((segment) => pageLabels[segment] ?? segment.replace(/-/g, " "));
}

export function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const { canManageTeam } = useRole();
  const { subscription } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const isMobile = useIsMobile();
  
  // Initialize upgrade assistant triggers
  useUpgradeAssistantTriggers();

  const getUpgradeBadgeText = () => {
    if (!subscription) return null;
    if (subscription.plan_type === 'free') return 'Free Plan — Upgrade';
    if (subscription.plan_type === 'starter') return 'Upgrade to Pro';
    return null;
  };

  const upgradeBadgeText = getUpgradeBadgeText();
  const crumbs = getCrumbs(location.pathname);
  const pageTitle = crumbs[crumbs.length - 1] ?? "Dashboard";

  const isOnboarding = location.pathname.startsWith("/ai/onboarding/agency");
  const isClientOnboarding =
    location.pathname.startsWith("/onboarding/client/") ||
    location.pathname.startsWith("/ai/onboarding/client/") ||
    location.pathname.startsWith("/onboarding/ai/client/");

  if (isOnboarding) {
    return (
      <div className="h-[100dvh] w-full overflow-x-hidden overflow-y-hidden">
        <main id="main-content" className="h-full min-h-0 overflow-x-hidden overflow-y-hidden p-0" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="saas-onboarding-theme flex h-[100dvh] w-full overflow-x-hidden overflow-y-hidden">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        {!isMobile && <AppSidebar />}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
          <header className="glass-header sticky top-0 z-20 flex h-16 items-center gap-3 px-3 md:px-5">
            {!isMobile && <SidebarTrigger className="text-muted-foreground hover:text-foreground" />}
            <div className="min-w-0 flex-1">
              <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                {crumbs.map((crumb, index) => (
                  <span key={`${crumb}-${index}`} className="flex items-center gap-2 capitalize">
                    {index > 0 ? <span className="text-border">/</span> : null}
                    {crumb}
                  </span>
                ))}
              </div>
              <div className="truncate font-display text-base font-semibold text-foreground md:text-lg">{pageTitle}</div>
            </div>
            <div className="hidden min-w-[260px] items-center gap-2 rounded-md border border-border/80 bg-surface/70 px-3 py-2 text-sm text-muted-foreground shadow-xs lg:flex">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">Search clients, approvals, or actions</span>
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Cmd K</kbd>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <ThemeToggle />
              {upgradeBadgeText && !isMobile && (
                <button
                  type="button"
                  className="focus-ring inline-flex min-h-[36px] items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                  onClick={() => openUpgradeModal()}
                >
                  <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
                  {upgradeBadgeText}
                </button>
              )}
              {canManageTeam && !isMobile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteDialog(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Team Member
                </Button>
              )}
              {!isMobile && <span className="hidden max-w-[180px] truncate text-sm text-muted-foreground xl:inline">{user?.email}</span>}
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className={
              isClientOnboarding
                ? isMobile
                  ? "flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-2 pb-2"
                  : "flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-3"
                : isMobile
                  ? "flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-4 pb-20"
                  : "flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-6"
            }
          >
            <Outlet />
          </main>
        </div>
      </div>

      {isMobile && !isClientOnboarding && <MobileBottomNav />}

      <InviteTeamMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </SidebarProvider>
  );
}
