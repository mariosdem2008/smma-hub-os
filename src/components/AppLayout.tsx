import { useState } from "react";
import { Outlet } from "react-router-dom";
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
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppLayout() {
  const { user } = useAuth();
  const { canManageTeam } = useRole();
  const { subscription } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  
  // Initialize upgrade assistant triggers
  useUpgradeAssistantTriggers();

  const getUpgradeBadgeText = () => {
    if (!subscription) return null;
    if (subscription.plan_type === 'free') return 'Free Plan — Upgrade';
    if (subscription.plan_type === 'starter' || subscription.plan_type === 'ltd_starter') return 'Upgrade to Pro';
    return null;
  };

  const upgradeBadgeText = getUpgradeBadgeText();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-surface px-4 shadow-sm">
            <SidebarTrigger />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-primary">SMMAHUB</h2>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {upgradeBadgeText && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors animate-pulse"
                  onClick={() => openUpgradeModal()}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {upgradeBadgeText}
                </Badge>
              )}
              {canManageTeam && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteDialog(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Team Member
                </Button>
              )}
              <span className="text-sm text-muted-foreground">{user?.email}</span>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <InviteTeamMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </SidebarProvider>
  );
}
