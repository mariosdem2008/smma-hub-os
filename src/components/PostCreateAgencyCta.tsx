import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const KEY = "postCreateAgencyCta";

export function PostCreateAgencyCta({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(sessionStorage.getItem(KEY) === "1");
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible || !isAdmin) return null;

  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium">Agency created</p>
          <p className="text-sm text-muted-foreground">Next: Open Agency AI Setup (Admin).</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              try {
                sessionStorage.removeItem(KEY);
              } catch {
                // ignore
              }
              navigate("/ai/admin");
            }}
          >
            Open Agency AI Setup (Admin)
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                sessionStorage.removeItem(KEY);
              } catch {
                // ignore
              }
              setVisible(false);
            }}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </Card>
  );
}

