import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { getUserAgencyBootstrap } from "@/lib/bootstrap";
import { decideBootstrap } from "@/lib/bootstrap-decision";
import { getActiveAgencyId, setActiveAgencyId } from "@/lib/active-agency";

function markBootstrapDone(userId: string) {
  try {
    sessionStorage.setItem(`bootstrap_done:${userId}`, "1");
  } catch {
    // ignore
  }
}

export default function Bootstrap() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const run = async () => {
      setError(null);
      try {
        const bootstrap = await getUserAgencyBootstrap();
        const decision = decideBootstrap(bootstrap, getActiveAgencyId());
        if (decision.action === "go_welcome") {
          markBootstrapDone(user.id);
          navigate("/welcome", { replace: true });
          return;
        }
        if (decision.action === "go_select_agency") {
          markBootstrapDone(user.id);
          navigate("/select-agency", { replace: true });
          return;
        }
        if (decision.action === "go_dashboard") {
          setActiveAgencyId(decision.agencyId);
          markBootstrapDone(user.id);
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to bootstrap your account");
      }
    };

    run();
  }, [navigate, user?.id]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Setting things up…</h1>
        <p className="text-muted-foreground">Loading your agency access.</p>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </Card>
    </div>
  );
}
