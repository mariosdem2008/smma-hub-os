import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type AdaptiveInputFieldProps = {
  expects: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  showMeta?: boolean;
  helperText?: string;
  inputId?: string;
  showSendButton?: boolean;
};

function validateInput(expects: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Input is required.";

  const mode = expects.toLowerCase();
  if (mode.includes("url")) {
    try {
      new URL(trimmed);
    } catch {
      return "Please enter a valid URL.";
    }
  }

  if (mode.includes("contact")) {
    const hasEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed);
    const hasPhone = /\+?[0-9][0-9\s\-()]{6,}/.test(trimmed);
    if (!hasEmail && !hasPhone) {
      return "Contact input must include an email or phone number.";
    }
  }

  return null;
}

export function AdaptiveInputField({
  expects,
  value,
  onChange,
  onSubmit,
  loading,
  showMeta = true,
  helperText,
  inputId,
  showSendButton = true,
}: AdaptiveInputFieldProps) {
  const [touched, setTouched] = useState(false);
  const error = useMemo(() => validateInput(expects, value), [expects, value]);
  const canSubmit = !loading && !error;

  return (
    <div className="space-y-3">
      {showMeta && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Input type: {expects}</span>
          <span>{helperText ?? "Press Enter to send, Shift+Enter for a new line"}</span>
        </div>
      )}
      <Textarea
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            setTouched(true);
            if (!error && !loading) onSubmit();
          }
        }}
        placeholder="Type your response..."
        className="min-h-[120px] resize-none"
      />
      {(touched || value.trim().length > 0) && error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {value.trim().length === 0 ? "Be as specific as you can." : `${value.trim().length} characters`}
        </div>
        {showSendButton ? (
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              setTouched(true);
              if (!error) onSubmit();
            }}
          >
            {loading ? "Sending..." : "Send"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
