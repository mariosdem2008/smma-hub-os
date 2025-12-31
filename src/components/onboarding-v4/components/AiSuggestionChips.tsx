// ============================================================================
// AI Suggestion Chips Component
// Displays AI-generated suggestions as selectable chips
// ============================================================================

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Sparkles, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnswerProvenance } from '@/types/onboarding';

interface Suggestion {
  id: string;
  label: string;
  confidence?: number;
}

type AiSuggestionChipsProps = {
  suggestions: Suggestion[];
  onSelect: (values: string[], provenance: AnswerProvenance) => void;
  multiSelect?: boolean;
  minSelect?: number;
  maxSelect?: number;
  allowCustom?: boolean;
  allowNotSure?: boolean;
  notSureDefault?: string;
  notSureLabel?: string;
  customPlaceholder?: string;
  loading?: boolean;
  isLoading?: boolean;
  className?: string;
} & (
  | {
      selected: string[];
      value?: never;
    }
  | {
      value: string | null;
      selected?: never;
    }
);

export function AiSuggestionChips({
  suggestions,
  onSelect,
  multiSelect = false,
  minSelect = 1,
  maxSelect = 1,
  allowCustom = true,
  allowNotSure = true,
  notSureDefault,
  notSureLabel = 'Not sure - let AI decide',
  customPlaceholder = 'Type your own answer...',
  loading,
  isLoading,
  className,
  ...selectionProps
}: AiSuggestionChipsProps) {
  const selected = 'selected' in selectionProps
    ? selectionProps.selected
    : selectionProps.value
      ? [selectionProps.value]
      : [];
  const effectiveLoading = loading ?? isLoading ?? false;
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handleChipClick = (suggestion: Suggestion) => {
    if (multiSelect) {
      const isSelected = selected.includes(suggestion.label);
      if (isSelected) {
        onSelect(selected.filter((s) => s !== suggestion.label), 'user_selected');
      } else if (selected.length < maxSelect) {
        onSelect([...selected, suggestion.label], 'user_selected');
      }
    } else {
      onSelect([suggestion.label], 'user_selected');
    }
    setShowCustomInput(false);
  };

  const handleAddCustom = () => {
    if (!customValue.trim()) return;

    if (multiSelect) {
      if (selected.length < maxSelect) {
        onSelect([...selected, customValue.trim()], 'user_typed');
      }
    } else {
      onSelect([customValue.trim()], 'user_typed');
    }

    setCustomValue('');
    setShowCustomInput(false);
  };

  const handleNotSure = () => {
    if (notSureDefault) {
      onSelect([notSureDefault], 'ai_assumed');
    } else if (suggestions.length > 0) {
      // Pick the highest confidence suggestion
      const sorted = [...suggestions].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      onSelect([sorted[0].label], 'ai_assumed');
    }
  };

  if (effectiveLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Generating suggestions...</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* AI badge */}
      {suggestions.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>AI-generated suggestions based on your answers</span>
        </div>
      )}

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => {
          const isSelected = selected.includes(suggestion.label);
          return (
            <Badge
              key={suggestion.id}
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer px-4 py-2 text-sm transition-all hover:scale-105',
                isSelected && 'ring-2 ring-primary ring-offset-2'
              )}
              onClick={() => handleChipClick(suggestion)}
            >
              {suggestion.label}
              {suggestion.confidence !== undefined && suggestion.confidence >= 80 && (
                <Sparkles className="ml-1 h-3 w-3" />
              )}
            </Badge>
          );
        })}

        {/* Custom values that were added */}
        {selected
          .filter((s) => !suggestions.some((sug) => sug.label === s))
          .map((customVal) => (
            <Badge
              key={`custom-${customVal}`}
              variant="default"
              className="cursor-pointer px-4 py-2 text-sm ring-2 ring-primary ring-offset-2"
              onClick={() => {
                if (multiSelect) {
                  onSelect(selected.filter((s) => s !== customVal), 'user_selected');
                } else {
                  onSelect([], 'user_selected');
                }
              }}
            >
              {customVal}
            </Badge>
          ))}
      </div>

      {/* Selection count */}
      {multiSelect && (
        <p className="text-xs text-muted-foreground">
          {selected.length} of {minSelect === maxSelect ? minSelect : `${minSelect}-${maxSelect}`} selected
        </p>
      )}

      {/* Custom input */}
      {allowCustom && (
        <div className="pt-2">
          {showCustomInput ? (
            <div className="flex gap-2">
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={customPlaceholder}
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                  if (e.key === 'Escape') {
                    setShowCustomInput(false);
                    setCustomValue('');
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustom}
                disabled={!customValue.trim()}
              >
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomValue('');
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCustomInput(true)}
              className="text-muted-foreground"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add custom answer
            </Button>
          )}
        </div>
      )}

      {/* Not sure button */}
      {allowNotSure && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleNotSure}
          className="text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4 mr-1" />
          {notSureLabel}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Single Select Chips (simplified version)
// ============================================================================

type SingleSelectChipsProps = {
  options: Array<{ id: string; label: string; description?: string; icon?: React.ReactNode }>;
  className?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
} & (
  | {
      selected: string | null;
      onSelect: (value: string, provenance: AnswerProvenance) => void;
      value?: never;
      onChange?: never;
    }
  | {
      value: string | null;
      onChange: (value: string) => void;
      selected?: never;
      onSelect?: never;
    }
);

export function SingleSelectChips(props: SingleSelectChipsProps) {
  const {
    options,
    className,
    allowCustom = false,
    customPlaceholder = 'Add a custom option',
  } = props;
  const selectedValue = 'selected' in props ? props.selected : props.value;
  const handleSelect = (value: string, provenance: AnswerProvenance = 'user_selected') => {
    if ('onSelect' in props) {
      props.onSelect(value, provenance);
      return;
    }
    props.onChange(value);
  };
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const isCustomSelected =
    !!selectedValue && !options.some((option) => option.id === selectedValue);
  const handleAddCustom = () => {
    if (!customValue.trim()) return;
    handleSelect(customValue.trim(), 'user_typed');
    setCustomValue('');
    setShowCustomInput(false);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {options.map((option, index) => {
        const isSelected = selectedValue === option.id;
        const key = option.id ? `option-${option.id}` : `option-${option.label}-${index}`;
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleSelect(option.id)}
            className={cn(
              'w-full text-left px-4 py-3 rounded-lg border transition-all',
              isSelected
                ? 'border-primary bg-primary/5 ring-2 ring-primary'
                : 'border-border hover:border-primary/50 hover:bg-accent'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {option.icon && (
                  <span className="text-primary">{option.icon}</span>
                )}
                <span className="font-medium">{option.label}</span>
              </span>
              {isSelected && (
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {option.description && (
              <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
            )}
          </button>
        );
      })}

      {isCustomSelected && (
        <button
          type="button"
          onClick={() => handleSelect(selectedValue)}
          className={cn(
            'w-full text-left px-4 py-3 rounded-lg border transition-all',
            'border-primary bg-primary/5 ring-2 ring-primary'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{selectedValue}</span>
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">(custom)</p>
        </button>
      )}

      {allowCustom && (
        <div className="pt-2">
          {showCustomInput ? (
            <div className="flex gap-2">
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={customPlaceholder}
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                  if (e.key === 'Escape') {
                    setShowCustomInput(false);
                    setCustomValue('');
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustom}
                disabled={!customValue.trim()}
              >
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomValue('');
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCustomInput(true)}
              className="text-muted-foreground"
            >
              <Plus className="h-4 w-4 mr-1" />
              {customPlaceholder}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Multi Select Chips with checkboxes
// ============================================================================

interface MultiSelectChipsProps {
  options: Array<{ id: string; label: string; description?: string; icon?: React.ReactNode }>;
  values: string[];
  onChange: (values: string[]) => void;
  minSelections?: number;
  maxSelections?: number;
  isLoading?: boolean;
  allowCustom?: boolean;
  customPlaceholder?: string;
  className?: string;
}

export function MultiSelectChips({
  options,
  values,
  onChange,
  minSelections = 1,
  maxSelections = 10,
  isLoading = false,
  allowCustom = false,
  customPlaceholder = 'Add custom option',
  className,
}: MultiSelectChipsProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handleToggle = (id: string) => {
    const isSelected = values.includes(id);
    if (isSelected) {
      onChange(values.filter((s) => s !== id));
    } else if (values.length < maxSelections) {
      onChange([...values, id]);
    }
  };

  const handleAddCustom = () => {
    if (!customValue.trim()) return;
    if (values.length < maxSelections) {
      onChange([...values, customValue.trim()]);
    }
    setCustomValue('');
    setShowCustomInput(false);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading options...</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {options.map((option) => {
        const isSelected = values.includes(option.id);
        const isDisabled = !isSelected && values.length >= maxSelections;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => !isDisabled && handleToggle(option.id)}
            disabled={isDisabled}
            className={cn(
              'w-full text-left px-4 py-3 rounded-lg border transition-all',
              isSelected
                ? 'border-primary bg-primary/5 ring-2 ring-primary'
                : isDisabled
                  ? 'border-border bg-muted opacity-50 cursor-not-allowed'
                  : 'border-border hover:border-primary/50 hover:bg-accent'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
                  isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                )}
              >
                {isSelected && (
                  <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {option.icon && (
                <span className="text-primary">{option.icon}</span>
              )}
              <div className="flex-1">
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* Custom values that were added */}
      {values
        .filter((v) => !options.some((opt) => opt.id === v))
        .map((customVal) => (
          <button
            key={`custom-${customVal}`}
            type="button"
            onClick={() => onChange(values.filter((v) => v !== customVal))}
            className="w-full text-left px-4 py-3 rounded-lg border border-primary bg-primary/5 ring-2 ring-primary transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded border-2 bg-primary border-primary flex items-center justify-center">
                <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="font-medium">{customVal}</span>
                <span className="text-xs text-muted-foreground ml-2">(custom)</span>
              </div>
            </div>
          </button>
        ))}

      {/* Custom input */}
      {allowCustom && (
        <div className="pt-2">
          {showCustomInput ? (
            <div className="flex gap-2">
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder={customPlaceholder}
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                  if (e.key === 'Escape') {
                    setShowCustomInput(false);
                    setCustomValue('');
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustom}
                disabled={!customValue.trim() || values.length >= maxSelections}
              >
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomValue('');
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCustomInput(true)}
              disabled={values.length >= maxSelections}
              className="text-muted-foreground"
            >
              <Plus className="h-4 w-4 mr-1" />
              {customPlaceholder}
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-2">
        Select {minSelections === maxSelections ? minSelections : `${minSelections}-${maxSelections}`} options ({values.length} selected)
      </p>
    </div>
  );
}
