import { useCallback, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type MultiSelectOption = {
  id: string;
  label: string;
  value: string;
  description?: string;
};

type ValidationRule = {
  type?: "array";
  minItems?: number;
  maxItems?: number;
  errorMessages?: {
    minItems?: string;
    maxItems?: string;
    required?: string;
  };
};

type MultiSelectProps = {
  title?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  validation?: ValidationRule;
  error?: string | null;
  disabled?: boolean;
  className?: string;
};

export function MultiSelect({
  title,
  options,
  value,
  onChange,
  validation,
  error,
  disabled = false,
  className,
}: MultiSelectProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = useCallback(
    (selectedValues: string[]): string | null => {
      if (!validation) return null;

      const filteredValues = selectedValues.filter((v) => v.trim().length > 0);

      if (validation.minItems !== undefined && filteredValues.length < validation.minItems) {
        return validation.errorMessages?.minItems ?? `Please select at least ${validation.minItems} items.`;
      }

      if (validation.maxItems !== undefined && filteredValues.length > validation.maxItems) {
        return validation.errorMessages?.maxItems ?? `Please select no more than ${validation.maxItems} items.`;
      }

      return null;
    },
    [validation],
  );

  const handleToggle = useCallback(
    (optionValue: string) => {
      if (disabled) return;

      const isSelected = value.includes(optionValue);
      let nextValue: string[];

      if (isSelected) {
        // Deselect
        nextValue = value.filter((v) => v !== optionValue);
      } else {
        // Select - check max limit
        if (validation?.maxItems !== undefined && value.length >= validation.maxItems) {
          setLocalError(
            validation.errorMessages?.maxItems ?? `You can select up to ${validation.maxItems} items only.`,
          );
          return;
        }
        nextValue = [...value, optionValue];
      }

      const validationError = validate(nextValue);
      setLocalError(validationError);
      onChange(nextValue);
    },
    [disabled, onChange, validate, validation?.errorMessages?.maxItems, validation?.maxItems, value],
  );

  const displayError = error ?? localError;

  return (
    <div className={cn("space-y-3", className)}>
      {title ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm font-semibold text-slate-100">
          {title}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = value.includes(option.value);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleToggle(option.value)}
              disabled={disabled}
              className={cn(
                "group relative flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all",
                isSelected
                  ? "border-[#4E5DFF] bg-[#4E5DFF]/10 shadow-md shadow-blue-500/20"
                  : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className={cn("font-medium", isSelected && "text-[#4E5DFF]")}>{option.label}</span>
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border-2 transition-all",
                    isSelected
                      ? "border-[#4E5DFF] bg-[#4E5DFF] text-white"
                      : "border-slate-600 group-hover:border-slate-500",
                  )}
                >
                  {isSelected ? <Check className="h-3 w-3" /> : null}
                </div>
              </div>
              {option.description ? (
                <span className="text-xs text-muted-foreground">{option.description}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {displayError ? (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {displayError}
        </div>
      ) : null}

      {validation?.minItems !== undefined || validation?.maxItems !== undefined ? (
        <div
          className={cn(
            "text-xs font-medium",
            value.length >= (validation.minItems ?? 0) && value.length <= (validation.maxItems ?? Infinity)
              ? "text-emerald-500"
              : "text-muted-foreground",
          )}
        >
          {validation.minItems !== undefined && validation.maxItems !== undefined
            ? `Select ${validation.minItems}-${validation.maxItems} items`
            : validation.minItems !== undefined
              ? `Select at least ${validation.minItems} item${validation.minItems === 1 ? "" : "s"}`
              : `Select up to ${validation.maxItems} item${validation.maxItems === 1 ? "" : "s"}`}{" "}
          <span className="font-semibold">({value.length} selected)</span>
          {value.length >= (validation.minItems ?? 0) && value.length <= (validation.maxItems ?? Infinity) && (
            <span className="ml-2">✓</span>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{value.length} selected</div>
      )}
    </div>
  );
}
