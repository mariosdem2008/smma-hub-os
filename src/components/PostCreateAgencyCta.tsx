import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "aiSetupCtaDismissed";

type Props = {
  isAdmin: boolean;
  aiSetupComplete: boolean | null;
};

export function PostCreateAgencyCta({ isAdmin, aiSetupComplete }: Props) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!isAdmin || aiSetupComplete !== false || dismissed) return null;

  return (
    <Card className="mb-6 border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-semibold">Finish AI Setup</p>
          <p className="text-sm text-muted-foreground">Complete the guided AI setup to unlock smarter outputs.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => navigate("/ai/admin?mode=guided_onboarding")}>Open AI Setup</Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                sessionStorage.setItem(DISMISS_KEY, "1");
              } catch {
                // ignore
              }
              setDismissed(true);
            }}
          >
            Remind me later
          </Button>
        </div>
      </div>
    </Card>
  );
}
