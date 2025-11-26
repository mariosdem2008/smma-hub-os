import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import ProfileTab from "@/components/settings/ProfileTab";
import TeamTab from "@/components/settings/TeamTab";
import SocialConnectionsTab from "@/components/settings/SocialConnectionsTab";
import NotificationsTab from "@/components/settings/NotificationsTab";
import BillingTab from "@/components/settings/BillingTab";

export default function Settings() {
  const { isOwner, isAdmin } = useRole();

  const canAccessBilling = isOwner;
  const canAccessTeam = isOwner || isAdmin;
  const canAccessSocialConnections = isOwner || isAdmin;

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
          {canAccessSocialConnections && (
            <TabsTrigger value="social">Social Connections</TabsTrigger>
          )}
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {canAccessBilling && <TabsTrigger value="billing">Billing</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        {canAccessTeam && (
          <TabsContent value="team">
            <TeamTab />
          </TabsContent>
        )}

        {canAccessSocialConnections && (
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
      </Tabs>
    </div>
  );
}
