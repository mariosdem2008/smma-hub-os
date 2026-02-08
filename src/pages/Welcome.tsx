import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyPendingAgencyInvites } from "@/lib/agency-invites";

export default function Welcome() {
  const navigate = useNavigate();
  const [inviteCount, setInviteCount] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const invites = await getMyPendingAgencyInvites();
        setInviteCount(invites.length);
      } catch {
        setInviteCount(0);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-2">Welcome</h1>
        <p className="text-muted-foreground mb-6">Are you a member of an existing agency?</p>

        <div className="flex flex-col gap-3">
          <Button variant="outline" onClick={() => navigate("/invitations")}>
            <span className="flex items-center gap-2">
              I'm a member of an agency
              {inviteCount > 0 && <Badge variant="secondary">{inviteCount}</Badge>}
            </span>
          </Button>
          <Button variant="default" onClick={() => navigate("/create-agency")}>
            Create an agency (AI-guided)
          </Button>
        </div>
      </Card>
    </div>
  );
}
