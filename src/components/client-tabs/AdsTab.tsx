import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useAdAccounts,
  useClientCampaignsWithInsights,
  useConnectAdAccount,
  useDisconnectAdAccount,
  useSyncMetaAds,
} from "@/hooks/useMetaAds";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  Target,
  RefreshCw,
  Plus,
  Trash2,
  TrendingUp,
  Megaphone,
} from "lucide-react";
import { format } from "date-fns";

interface AdsTabProps {
  clientId: string;
  agencyId: string;
}

export default function AdsTab({ clientId, agencyId }: AdsTabProps) {
  const { toast } = useToast();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");

  const { data: adAccounts, isLoading: accountsLoading } = useAdAccounts(clientId);
  const { data: campaigns, isLoading: campaignsLoading } = useClientCampaignsWithInsights(clientId);

  const connectMutation = useConnectAdAccount();
  const disconnectMutation = useDisconnectAdAccount();
  const syncMutation = useSyncMetaAds();

  const handleConnect = async () => {
    if (!newAccountId.trim()) {
      toast({ title: "Error", description: "Please enter an Ad Account ID", variant: "destructive" });
      return;
    }

    try {
      await connectMutation.mutateAsync({
        clientId,
        agencyId,
        metaAdAccountId: newAccountId.trim(),
        accountName: newAccountName.trim() || undefined,
      });
      toast({ title: "Success", description: "Ad account connected successfully" });
      setConnectDialogOpen(false);
      setNewAccountId("");
      setNewAccountName("");
      // Trigger sync after connecting
      syncMutation.mutate(clientId);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to connect ad account", variant: "destructive" });
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await disconnectMutation.mutateAsync({ accountId, clientId });
      toast({ title: "Success", description: "Ad account disconnected" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to disconnect", variant: "destructive" });
    }
  };

  const handleSync = () => {
    syncMutation.mutate(clientId, {
      onSuccess: (data) => {
        if (data.permissionError) {
          toast({
            title: "Permission Error",
            description: data.permissionError,
            variant: "destructive",
          });
        } else {
          toast({ title: "Sync Complete", description: "Ad data synced successfully" });
        }
      },
      onError: (error: any) => {
        toast({
          title: "Sync Error",
          description: error.message || "Failed to sync ad data",
          variant: "destructive",
        });
      },
    });
  };

  // Calculate totals
  const totals = campaigns?.reduce(
    (acc, c) => ({
      spend: acc.spend + c.totalSpend,
      impressions: acc.impressions + c.totalImpressions,
      clicks: acc.clicks + c.totalClicks,
      reach: acc.reach + c.totalReach,
      conversions: acc.conversions + c.totalConversions,
    }),
    { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0 }
  ) || { spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0 };

  const isLoading = accountsLoading || campaignsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!adAccounts || adAccounts.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <div className="w-16 h-16 bg-gradient-to-br from-primary/5 to-accent/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
            <Megaphone className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground font-medium mb-2">No Ad Accounts Connected</p>
          <p className="text-sm text-muted-foreground mb-6">
            Connect your Meta Ad Account to view campaign performance and insights.
          </p>
          <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Connect Ad Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Meta Ad Account</DialogTitle>
                <DialogDescription>
                  Enter your Meta Ad Account ID to start tracking campaign performance.
                  <span className="block mt-2 text-xs">
                    <strong>Note:</strong> Make sure your Facebook/Instagram connection has Ads permissions. 
                    If data doesn't sync, reconnect social profiles with full permissions.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId">Ad Account ID *</Label>
                  <Input
                    id="accountId"
                    placeholder="e.g., 123456789012345"
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this in Meta Business Settings → Ad Accounts
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name (optional)</Label>
                  <Input
                    id="accountName"
                    placeholder="e.g., Main Ads Account"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConnect} disabled={connectMutation.isPending}>
                  {connectMutation.isPending ? "Connecting..." : "Connect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Meta Ads Performance</h2>
          <p className="text-sm text-muted-foreground">Last 30 days</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sync Data
          </Button>
          <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Meta Ad Account</DialogTitle>
                <DialogDescription>
                  Enter your Meta Ad Account ID to start tracking campaign performance.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="accountId2">Ad Account ID *</Label>
                  <Input
                    id="accountId2"
                    placeholder="e.g., 123456789012345"
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName2">Account Name (optional)</Label>
                  <Input
                    id="accountName2"
                    placeholder="e.g., Main Ads Account"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConnect} disabled={connectMutation.isPending}>
                  {connectMutation.isPending ? "Connecting..." : "Connect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="flex flex-wrap gap-2">
        {adAccounts.map((account) => (
          <Badge key={account.id} variant="secondary" className="px-3 py-1.5 text-sm">
            {account.account_name || account.meta_ad_account_id}
            <button
              onClick={() => handleDisconnect(account.id)}
              className="ml-2 hover:text-destructive"
              disabled={disconnectMutation.isPending}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Total Spend</p>
                <p className="text-2xl font-bold">${totals.spend.toFixed(2)}</p>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Impressions</p>
                <p className="text-2xl font-bold">{totals.impressions.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Eye className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Clicks</p>
                <p className="text-2xl font-bold">{totals.clicks.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-accent to-accent/80 shadow-lg">
                <MousePointerClick className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Reach</p>
                <p className="text-2xl font-bold">{totals.reach.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground font-medium">Conversions</p>
                <p className="text-2xl font-bold">{totals.conversions.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-2 bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Campaigns ({campaigns?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!campaigns || campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No campaigns found. Click "Sync Data" to fetch your campaigns.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Campaign</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-right py-3 px-2 font-medium">Spend</th>
                    <th className="text-right py-3 px-2 font-medium">Impressions</th>
                    <th className="text-right py-3 px-2 font-medium">Clicks</th>
                    <th className="text-right py-3 px-2 font-medium">CTR</th>
                    <th className="text-right py-3 px-2 font-medium">CPC</th>
                    <th className="text-right py-3 px-2 font-medium">Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          {campaign.objective && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {campaign.objective.replace(/_/g, " ")}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge
                          variant={campaign.status === "ACTIVE" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {campaign.status?.toLowerCase() || "unknown"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right font-medium">
                        ${campaign.totalSpend.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {campaign.totalImpressions.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {campaign.totalClicks.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {campaign.avgCtr.toFixed(2)}%
                      </td>
                      <td className="py-3 px-2 text-right">
                        ${campaign.avgCpc.toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {campaign.totalConversions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
