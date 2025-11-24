import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface AuditMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
  invited_by: string | null;
  profile: {
    email: string;
    full_name: string | null;
  } | null;
  inviter_profile: {
    email: string;
    full_name: string | null;
  } | null;
}

export default function TeamAuditDebug() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<AuditMember[]>([]);
  const [agencyId, setAgencyId] = useState<string>("");

  useEffect(() => {
    fetchAuditData();
  }, [user]);

  const fetchAuditData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get agency
      const { data: agency } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("user_id", user.id)
        .single();

      if (!agency) return;
      setAgencyId(agency.id);

      // Fetch agency members with audit trail data
      const { data: membersData, error } = await supabase
        .from("agency_members")
        .select("*")
        .eq("agency_id", agency.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for all members and inviters
      const userIds = membersData?.map((m) => m.user_id) || [];
      const inviterIds = membersData?.map((m) => m.invited_by).filter(Boolean) || [];
      const allUserIds = [...new Set([...userIds, ...inviterIds])];

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", allUserIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]));

        const membersWithProfiles = membersData?.map((member) => ({
          ...member,
          profile: profileMap.get(member.user_id) || null,
          inviter_profile: member.invited_by ? profileMap.get(member.invited_by) : null,
        }));

        setMembers(membersWithProfiles || []);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      console.error("Error fetching audit data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading audit data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Team Audit Trail Debug</h1>
        <p className="text-muted-foreground">View invitation audit trail data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agency Members Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No members found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Accepted At</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {member.profile?.full_name || "N/A"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.profile?.email || "N/A"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge>{member.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {member.invited_by ? (
                        <div>
                          <div className="text-sm">
                            {member.inviter_profile?.full_name || "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.inviter_profile?.email || "N/A"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Original Owner
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.accepted_at ? (
                        <div className="text-sm">
                          {format(new Date(member.accepted_at), "MMM d, yyyy HH:mm")}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(member.created_at), "MMM d, yyyy HH:mm")}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="text-sm">Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm font-mono">
            <div>
              <span className="text-muted-foreground">Agency ID:</span>{" "}
              <span className="text-foreground">{agencyId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Members:</span>{" "}
              <span className="text-foreground">{members.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">With Audit Trail:</span>{" "}
              <span className="text-foreground">
                {members.filter((m) => m.accepted_at || m.invited_by).length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
