import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TagOption = {
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

type TagSelectorProps = {
  options: TagOption[];
  value: string[];
  onChange: (value: string[]) => void;
  validation?: ValidationRule;
  error?: string | null;
  disabled?: boolean;
  className?: string;
};

export function TagSelector({
  options,
  value,
  onChange,
  validation,
  error,
  disabled = false,
  className,
}: TagSelectorProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = useCallback(
    (selectedValues: string[]): string | null => {
      if (!validation) return null;

      const filteredValues = selectedValues.filter((v) => v.trim().length > 0);

      if (validation.minItems !== undefined && filteredValues.length < validation.minItems) {
        return validation.errorMessages?.minItems ?? `Please select exactly ${validation.minItems} items.`;
      }

      if (validation.maxItems !== undefined && filteredValues.length > validation.maxItems) {
        return validation.errorMessages?.maxItems ?? `Please select exactly ${validation.maxItems} items.`;
      }

      return null;
    },
    [validation],
  );

  const handleSelect = useCallback(
    (optionValue: string) => {
      if (disabled) return;

      const isSelected = value.includes(optionValue);

      if (isSelected) {
        // Deselect
        const nextValue = value.filter((v) => v !== optionValue);
        const validationError = validate(nextValue);
        setLocalError(validationError);
        onChange(nextValue);
      } else {
        // Select - check max limit
        if (validation?.maxItems !== undefined && value.length >= validation.maxItems) {
          setLocalError(
            validation.errorMessages?.maxItems ?? `You can select exactly ${validation.maxItems} items only.`,
          );
          return;
        }
        const nextValue = [...value, optionValue];
        const validationError = validate(nextValue);
        setLocalError(validationError);
        onChange(nextValue);
      }
    },
    [disabled, onChange, validate, validation?.errorMessages?.maxItems, validation?.maxItems, value],
  );

  const handleRemove = useCallback(
    (optionValue: string) => {
      if (disabled) return;
      const nextValue = value.filter((v) => v !== optionValue);
      const validationError = validate(nextValue);
      setLocalError(validationError);
      onChange(nextValue);
    },
    [disabled, onChange, validate, value],
  );

  const displayError = error ?? localError;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Selected tags display */}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((val) => {
            const option = options.find((opt) => opt.value === val);
            return (
              <div
                key={val}
                className="flex items-center gap-1 rounded-full bg-[#4E5DFF] px-3 py-1 text-sm font-medium text-white shadow-md shadow-blue-500/30"
              >
                <span>{option?.label ?? val}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(val)}
                  disabled={disabled}
                  className="ml-1 rounded-full hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove ${option?.label ?? val}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Available options */}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = value.includes(option.value);
          if (isSelected) return null; // Don't show already selected tags

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.value)}
              disabled={disabled}
              className={cn(
                "group flex items-center gap-2 rounded-full border-2 border-slate-700 bg-slate-800/50 px-3 py-1 text-sm transition-all hover:border-[#4E5DFF] hover:bg-[#4E5DFF]/10 hover:shadow-md hover:shadow-blue-500/20",
                disabled && "cursor-not-allowed opacity-50",
              )}
              title={option.description}
            >
              <span>{option.label}</span>
              {option.description ? (
                <span className="hidden text-xs text-muted-foreground group-hover:inline">
                  ({option.description})
                </span>
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
          {validation.minItems === validation.maxItems
            ? `Select exactly ${validation.minItems} tag${validation.minItems === 1 ? "" : "s"}`
            : validation.minItems !== undefined && validation.maxItems !== undefined
              ? `Select ${validation.minItems}-${validation.maxItems} tags`
              : validation.minItems !== undefined
                ? `Select at least ${validation.minItems} tag${validation.minItems === 1 ? "" : "s"}`
                : `Select up to ${validation.maxItems} tag${validation.maxItems === 1 ? "" : "s"}`}{" "}
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
