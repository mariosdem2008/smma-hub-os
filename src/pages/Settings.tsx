import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import ProfileTab from "@/components/settings/ProfileTab";
import TeamTab from "@/components/settings/TeamTab";
import NotificationsTab from "@/components/settings/NotificationsTab";
import BillingTab from "@/components/settings/BillingTab";
import SocialConnectionsTab from "@/components/settings/SocialConnectionsTab";
import LogsTab from "@/pages/settings/LogsTab";

export default function Settings() {
  const { isOwner, isAdmin, isManager } = useRole();

  const canAccessBilling = isOwner;
  const canAccessTeam = isOwner || isAdmin;
  const canAccessSocial = isOwner || isAdmin || isManager;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and agency settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {canAccessTeam && <TabsTrigger value="team">Team</TabsTrigger>}
          {canAccessSocial && <TabsTrigger value="social">Social Connections</TabsTrigger>}
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {canAccessBilling && <TabsTrigger value="billing">Billing</TabsTrigger>}
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

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
