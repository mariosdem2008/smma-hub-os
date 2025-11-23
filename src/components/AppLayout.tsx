import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { InviteTeamMemberDialog } from "./InviteTeamMemberDialog";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppLayout() {
  const { user } = useAuth();
  const { canManageTeam } = useRole();
  const [showInviteDialog, setShowInviteDialog] = useState(false);

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
