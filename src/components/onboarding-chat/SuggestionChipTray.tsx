type SuggestionChipTrayProps = {
  suggestions: string[];
  onAutofill: (suggestion: string) => void;
  disabled?: boolean;
  title?: string;
  hint?: string;
};

export function SuggestionChipTray({
  suggestions,
  onAutofill,
  disabled,
  title = "Quick replies",
  hint = "Tap to autofill",
}: SuggestionChipTrayProps) {
  if (!suggestions.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{title}</span>
        <span>{hint}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onAutofill(suggestion)}
            className="rounded-xl border border-white/10 bg-[#0b0f1a] p-4 text-left text-sm leading-relaxed text-white/90 shadow-sm hover:border-primary/40 hover:bg-[#0f1524] disabled:opacity-60"
          >
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">Suggested</div>
            <div className="mt-2">{suggestion}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
