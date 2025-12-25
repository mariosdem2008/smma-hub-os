import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AgencyAiAdmin() {
  const { isAdmin, loading } = useRole();

  if (loading) {
    return (
      <div className="container max-w-5xl py-10">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container max-w-5xl py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agency AI</h1>
        <p className="text-sm text-muted-foreground">Admin-only</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Chat</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Setup not connected yet. TODO: wire to an agency-scoped edge function (e.g. <code>ai-agency-rep-chat</code>).
        </CardContent>
      </Card>
    </div>
  );
}

