import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getUserAgencyBootstrap, type BootstrapMembership } from "@/lib/bootstrap";
import { getActiveAgencyId, setActiveAgencyId } from "@/lib/active-agency";

function markBootstrapDone(userId: string) {
  try {
    sessionStorage.setItem(`bootstrap_done:${userId}`, "1");
  } catch {
    // ignore
  }
}

export default function SelectAgency() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<BootstrapMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const bootstrap = await getUserAgencyBootstrap();
        const list = bootstrap.memberships ?? [];

        if (list.length === 1) {
          setActiveAgencyId(list[0].agency_id);
          if (user?.id) markBootstrapDone(user.id);
          navigate("/dashboard", { replace: true });
          return;
        }

        setMemberships(list);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load agencies");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate, user?.id]);

  const selected = getActiveAgencyId();
  const sorted = useMemo(() => {
    return [...memberships].sort((a, b) => {
      if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
      return (a.agency_name ?? "").localeCompare(b.agency_name ?? "");
    });
  }, [memberships]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <p className="text-muted-foreground">Loading agencies…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-2">Select an agency</h1>
        <p className="text-muted-foreground mb-6">You belong to multiple agencies.</p>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-2">
          {sorted.map((m) => (
            <Button
              key={m.agency_id}
              variant={selected === m.agency_id ? "default" : "outline"}
              onClick={() => {
                setActiveAgencyId(m.agency_id);
                if (user?.id) markBootstrapDone(user.id);
                navigate("/dashboard", { replace: true });
              }}
            >
              {m.agency_name || m.agency_id}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}

