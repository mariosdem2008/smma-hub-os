import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type AiFieldState = "empty" | "suggested" | "edited_by_human" | "approved_locked" | "stale";

export type AiFieldProps = {
  title: string;
  initialState?: AiFieldState;
  initialValue?: string;
  citations?: string[];
};

export function AIField({ title, initialState = "empty", initialValue = "", citations = [] }: AiFieldProps) {
  const [state, setState] = useState<AiFieldState>(initialState);
  const [value, setValue] = useState(initialValue);
  const [showWhy, setShowWhy] = useState(false);

  const isEditable = state !== "approved_locked";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs text-muted-foreground">State: {state}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={!isEditable}
          placeholder="AI output will appear here"
          rows={4}
        />

        {showWhy && (
          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Citations</div>
            {citations.length === 0 ? <div>No citations available.</div> : citations.map((c) => <div key={c}>{c}</div>)}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setState("suggested")}>Generate</Button>
          <Button variant="outline" onClick={() => setState("suggested")}>Regenerate</Button>
          <Button variant="outline" onClick={() => setShowWhy((prev) => !prev)}>Why this?</Button>
          <Button onClick={() => setState("approved_locked")}>Accept</Button>
          <Button variant="secondary" onClick={() => setState("edited_by_human")}>Edit</Button>
          <Button variant="outline" onClick={() => setState("stale")}>Request changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}
