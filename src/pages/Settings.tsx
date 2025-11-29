import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { hapticSelection } from "@/lib/haptics";
import ProfileTab from "@/components/settings/ProfileTab";
import TeamTab from "@/components/settings/TeamTab";
import NotificationsTab from "@/components/settings/NotificationsTab";
import BillingTab from "@/components/settings/BillingTab";
import SocialConnectionsTab from "@/components/settings/SocialConnectionsTab";
import TaskTemplatesTab from "@/components/settings/TaskTemplatesTab";
import LogsTab from "@/pages/settings/LogsTab";

export default function Settings() {
  const { isOwner, isAdmin, isManager } = useRole();
  const isMobile = useIsMobile();

  const canAccessBilling = isOwner;
  const canAccessTeam = isOwner || isAdmin;
  const canAccessSocial = isOwner || isAdmin || isManager;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage your account and agency settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4 md:space-y-6" onValueChange={() => hapticSelection()}>
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-full md:w-full h-auto">
            <TabsTrigger value="profile" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Profile</TabsTrigger>
            {canAccessTeam && <TabsTrigger value="team" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Team</TabsTrigger>}
            {canAccessSocial && <TabsTrigger value="social" className="flex-shrink-0 min-h-[44px] px-3 md:px-4 whitespace-nowrap">Social</TabsTrigger>}
            <TabsTrigger value="notifications" className="flex-shrink-0 min-h-[44px] px-3 md:px-4 whitespace-nowrap">Notifications</TabsTrigger>
            <TabsTrigger value="templates" className="flex-shrink-0 min-h-[44px] px-3 md:px-4 whitespace-nowrap">Templates</TabsTrigger>
            {canAccessBilling && <TabsTrigger value="billing" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Billing</TabsTrigger>}
            <TabsTrigger value="logs" className="flex-shrink-0 min-h-[44px] px-3 md:px-4">Logs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        {canAccessTeam && (
          <TabsContent value="team">
            <TeamTab />
          </TabsContent>
        )}

        {canAccessSocial && (
          <TabsContent value="social">
            <SocialConnectionsTab />
          </TabsContent>
        )}

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="templates">
          <TaskTemplatesTab />
        </TabsContent>

        {canAccessBilling && (
          <TabsContent value="billing">
            <BillingTab />
          </TabsContent>
        )}

        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
