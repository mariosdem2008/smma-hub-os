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
import { Badge } from "@/components/ui/badge";
import { UserPlus, Sparkles } from "lucide-react";
import { InviteTeamMemberDialog } from "./InviteTeamMemberDialog";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

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

  const isOnboarding = location.pathname.startsWith("/ai/onboarding/agency");

  if (isOnboarding) {
    return (
      <div className="min-h-screen w-full">
        <main className="min-h-screen p-0">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="saas-onboarding-theme flex min-h-screen w-full">
        {!isMobile && <AppSidebar />}
        <div className="relative z-10 flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-white/10 bg-black/45 px-4 backdrop-blur-md">
            {!isMobile && <SidebarTrigger className="icon-hover" />}
            <div className="flex-1">
              <h2 className="bg-gradient-to-r from-[#5b5fff] to-[#22d3ee] bg-clip-text text-lg font-bold text-transparent">SMMAHUB</h2>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <NotificationCenter />
              {upgradeBadgeText && !isMobile && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-all duration-200 border-0"
                  onClick={() => openUpgradeModal()}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {upgradeBadgeText}
                </Badge>
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
              {!isMobile && <span className="text-sm text-muted-foreground hidden md:inline">{user?.email}</span>}
            </div>
          </header>
          <main className={isMobile ? "flex-1 p-4 pb-20" : "flex-1 p-6"}>
            <Outlet />
          </main>
        </div>
      </div>

      {isMobile && <MobileBottomNav />}

      <InviteTeamMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </SidebarProvider>
  );
}
