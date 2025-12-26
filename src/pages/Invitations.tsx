import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { acceptAgencyInvite, declineAgencyInvite, getMyPendingAgencyInvites, type PendingAgencyInvite } from "@/lib/agency-invites";
import { setActiveAgencyId } from "@/lib/active-agency";
import { getUserAgencyBootstrap } from "@/lib/bootstrap";

export default function Invitations() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invites, setInvites] = useState<PendingAgencyInvite[]>([]);

  const inviteCount = invites.length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyPendingAgencyInvites();
      setInvites(data);
    } catch (err: any) {
      toast({ title: "Failed to load invitations", description: err?.message ?? "Unknown error", variant: "destructive" });
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => {
    return [...invites].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [invites]);

  const handleAccept = async (inviteId: string) => {
    setBusyId(inviteId);
    try {
      const agencyId = await acceptAgencyInvite(inviteId);

      const bootstrap = await getUserAgencyBootstrap();
      const memberships = bootstrap.memberships ?? [];
      const uniq = Array.from(new Set(memberships.map((m) => m.agency_id))).map(
        (agency_id) => memberships.find((m) => m.agency_id === agency_id)!,
      );

      if (uniq.length > 1) {
        if (agencyId) setActiveAgencyId(agencyId);
        navigate("/select-agency", { replace: true });
        return;
      }
      if (uniq.length === 1) {
        setActiveAgencyId(uniq[0].agency_id);
        navigate("/dashboard", { replace: true });
        return;
      }

      navigate("/bootstrap", { replace: true });
    } catch (err: any) {
      const message = err?.message ?? "Unknown error";
      toast({
        title: "Failed to accept invite",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    setBusyId(inviteId);
    try {
      await declineAgencyInvite(inviteId);
      await load();
    } catch (err: any) {
      toast({
        title: "Failed to decline invite",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center text-muted-foreground">Loading invitations...</CardContent>
        </Card>
      </div>
    );
  }

  if (inviteCount === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8">
          <CardHeader className="p-0 mb-4">
            <CardTitle>Invitations</CardTitle>
            <CardDescription>No invitations found. Ask your admin to invite you.</CardDescription>
          </CardHeader>
          <Button onClick={() => navigate("/welcome")} variant="outline" className="w-full">
            Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl p-8">
        <CardHeader className="p-0 mb-6">
          <CardTitle className="flex items-center gap-2">
            Invitations <Badge variant="secondary">{inviteCount}</Badge>
          </CardTitle>
          <CardDescription>Accept an invitation to join an agency.</CardDescription>
        </CardHeader>

        <div className="space-y-3">
          {sorted.map((inv) => (
            <div
              key={inv.invite_id}
              className="rounded-md border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{inv.agency_name}</div>
                <div className="text-sm text-muted-foreground">Role: {inv.role}</div>
                <div className="text-xs text-muted-foreground">Invited: {new Date(inv.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleAccept(inv.invite_id)} disabled={busyId === inv.invite_id}>
                  {busyId === inv.invite_id ? "Working..." : "Accept"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDecline(inv.invite_id)}
                  disabled={busyId === inv.invite_id}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Button onClick={() => navigate("/welcome")} variant="outline">
            Back
          </Button>
        </div>
      </Card>
    </div>
  );
}
