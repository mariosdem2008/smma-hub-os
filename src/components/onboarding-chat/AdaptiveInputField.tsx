import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  fieldPath?: string;
  validationRule?: string;
  validationCode?: string;
  validationHelp?: string;
  validationExample?: string;
  onValidationChange?: (message: string | null) => void;
};

type StructuredFieldConfig = {
  columns: string[];
};

const STRUCTURED_FIELD_CONFIG: Record<string, StructuredFieldConfig> = {
  "agency.service_catalog": { columns: ["Service", "Scope summary"] },
  "agency.top_margin_offers": { columns: ["Offer name", "3 deliverables", "EUR/mo range", "High-margin reason"] },
  "agency.packaged_offers": { columns: ["Offer name", "KPI outcome", "Deliverables", "Duration", "EUR range"] },
  "agency.price_ranges_by_tier": { columns: ["Tier", "Low EUR", "High EUR"] },
  "operations.required_client_assets": { columns: ["Asset", "Max delay days"] },
  "operations.approval_workflow": { columns: ["Role", "Method", "SLA hours"] },
};

const TIMEZONE_OPTIONS = [
  "Europe/Athens",
  "Europe/Nicosia",
  "Europe/London",
  "Asia/Dubai",
  "America/New_York",
  "America/Los_Angeles",
];

function parseLines(value: string) {
  return value
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseStructuredRows(value: string, columnCount: number) {
  const lines = parseLines(value);
  if (lines.length === 0) {
    return [Array.from({ length: columnCount }, () => "")];
  }
  return lines.map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    const padded = Array.from({ length: columnCount }, (_, index) => parts[index] ?? "");
    return padded;
  });
}

function serializeStructuredRows(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => cell.trim()).filter(Boolean))
    .filter((row) => row.length > 0)
    .map((row) => row.join(" | "))
    .join("\n");
}

function parsePercentRows(value: string) {
  const lines = parseLines(value);
  if (lines.length === 0) return [{ label: "", percent: "" }];
  return lines.map((line) => {
    const commaParts = line.split(",").map((part) => part.trim());
    if (commaParts.length >= 2) {
      return { label: commaParts[0] ?? "", percent: (commaParts[1] ?? "").replace(/%/g, "") };
    }
    const match = line.match(/^(.*?)(\d+)\s*%?$/);
    if (match) return { label: (match[1] ?? "").trim(), percent: (match[2] ?? "").trim() };
    return { label: line, percent: "" };
  });
}

function serializePercentRows(rows: Array<{ label: string; percent: string }>) {
  return rows
    .filter((row) => row.label.trim().length > 0 || row.percent.trim().length > 0)
    .map((row) => `${row.label.trim()}, ${row.percent.trim()}%`)
    .join("\n");
}

function validateInput(expects: string, value: string, fieldPath?: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lines = parseLines(trimmed);

  const mode = expects.toLowerCase();

  if (fieldPath === "agency.name") {
    if (trimmed.length < 3 || trimmed.length > 80) return "Use 3-80 plain characters.";
    if (/[\u{1F300}-\u{1FAFF}]/u.test(trimmed)) return "Agency name cannot contain emojis.";
  }

  if (fieldPath === "agency.key_differentiators") {
    if (lines.length !== 3) return "Provide exactly 3 bullet lines.";
  }

  if (fieldPath === "agency.best_client_summary") {
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    if (words < 10 || words > 30) return "Use one sentence between 10 and 30 words.";
  }

  if (fieldPath === "agency.timezone" || mode.includes("tz_lang")) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    } catch {
      return "Pick a valid IANA timezone.";
    }
  }

  if (fieldPath === "agency.primary_client_languages") {
    const numbers = (trimmed.match(/\d+/g) ?? []).map((n) => Number(n));
    const sum = numbers.reduce((acc, n) => acc + n, 0);
    if (numbers.length < 1 || sum !== 100) return "Percent values must sum exactly to 100.";
  }

  if (fieldPath === "agency.client_type_split") {
    const numbers = (trimmed.match(/\d+/g) ?? []).map((n) => Number(n));
    const sum = numbers.reduce((acc, n) => acc + n, 0);
    if (numbers.length < 3 || sum !== 100) return "Percent values must sum exactly to 100.";
  }

  if (!fieldPath && mode.includes("percent")) {
    const numbers = (trimmed.match(/\d+/g) ?? []).map((n) => Number(n));
    const sum = numbers.reduce((acc, n) => acc + n, 0);
    if (numbers.length < 2 || sum !== 100) return "Percent values must sum exactly to 100.";
  }

  if (mode.includes("url") || fieldPath === "agency.website_and_links" || fieldPath === "agency.competitor_urls") {
    for (const line of lines) {
      try {
        const url = new URL(line);
        if (!["http:", "https:"].includes(url.protocol)) return "URL must start with http:// or https://";
      } catch {
        return "Please enter valid URL values.";
      }
    }
  }

  if (fieldPath === "agency.top_industries" && lines.length > 5) return "You can provide up to 5 industries.";
  if (fieldPath === "agency.top_margin_offers" && (lines.length < 1 || lines.length > 2)) return "Provide 1-2 offers.";
  if (fieldPath === "agency.packaged_offers" && (lines.length < 1 || lines.length > 5)) return "Provide 1-5 packaged offers.";

  if (mode.includes("numeric")) {
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return "Use a numeric value.";
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
  fieldPath,
  validationRule,
  validationCode,
  validationHelp,
  validationExample,
  onValidationChange,
}: AdaptiveInputFieldProps) {
  const [touched, setTouched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [structuredRowsState, setStructuredRowsState] = useState<string[][]>([]);
  const [percentRowsState, setPercentRowsState] = useState<Array<{ label: string; percent: string }>>([]);
  const structuredConfig = fieldPath ? STRUCTURED_FIELD_CONFIG[fieldPath] : undefined;
  const percentMode = fieldPath === "agency.primary_client_languages" || fieldPath === "agency.client_type_split" || expects.toLowerCase().includes("percent");
  const numericMode = expects.toLowerCase().includes("numeric") && !structuredConfig && !percentMode;
  const timezoneMode = fieldPath === "agency.timezone";
  const error = useMemo(() => validateInput(expects, value, fieldPath), [expects, value, fieldPath]);
  const canSubmit = !loading && value.trim().length > 0 && !error;
  const isExpanded = isFocused || value.trim().length > 0;
  const supportsGuidedInput = timezoneMode || numericMode || percentMode || Boolean(structuredConfig);

  useEffect(() => {
    onValidationChange?.(error);
  }, [error, onValidationChange]);

  useEffect(() => {
    if (!structuredConfig) {
      setStructuredRowsState([]);
      return;
    }
    setStructuredRowsState(parseStructuredRows(value, structuredConfig.columns.length));
  }, [fieldPath, structuredConfig?.columns.length, value]);

  useEffect(() => {
    if (!percentMode) {
      setPercentRowsState([]);
      return;
    }
    setPercentRowsState(parsePercentRows(value));
  }, [fieldPath, percentMode, value]);

  const updateStructuredCell = (rowIndex: number, colIndex: number, nextValue: string) => {
    if (!structuredConfig) return;
    const rows = structuredRowsState.length
      ? structuredRowsState.map((row) => [...row])
      : parseStructuredRows(value, structuredConfig.columns.length);
    rows[rowIndex][colIndex] = nextValue;
    setStructuredRowsState(rows);
    onChange(serializeStructuredRows(rows));
  };

  const addStructuredRow = () => {
    if (!structuredConfig) return;
    const rows = structuredRowsState.length
      ? structuredRowsState.map((row) => [...row])
      : parseStructuredRows(value, structuredConfig.columns.length);
    rows.push(Array.from({ length: structuredConfig.columns.length }, () => ""));
    setStructuredRowsState(rows);
    onChange(serializeStructuredRows(rows));
  };

  const removeStructuredRow = (rowIndex: number) => {
    if (!structuredConfig) return;
    const rows = structuredRowsState.length
      ? structuredRowsState.map((row) => [...row])
      : parseStructuredRows(value, structuredConfig.columns.length);
    const nextRows = rows.filter((_, index) => index !== rowIndex);
    const fallbackRows = nextRows.length ? nextRows : [Array.from({ length: structuredConfig.columns.length }, () => "")];
    setStructuredRowsState(fallbackRows);
    onChange(serializeStructuredRows(fallbackRows));
  };

  const updatePercentRow = (rowIndex: number, key: "label" | "percent", nextValue: string) => {
    const rows = percentRowsState.length
      ? percentRowsState.map((row) => ({ ...row }))
      : parsePercentRows(value);
    rows[rowIndex][key] = nextValue;
    setPercentRowsState(rows);
    onChange(serializePercentRows(rows));
  };

  const addPercentRow = () => {
    const rows = percentRowsState.length
      ? percentRowsState.map((row) => ({ ...row }))
      : parsePercentRows(value);
    rows.push({ label: "", percent: "" });
    setPercentRowsState(rows);
    onChange(serializePercentRows(rows));
  };

  const removePercentRow = (rowIndex: number) => {
    const rows = percentRowsState.length
      ? percentRowsState.map((row) => ({ ...row }))
      : parsePercentRows(value);
    const nextRows = rows.filter((_, index) => index !== rowIndex);
    const fallbackRows = nextRows.length ? nextRows : [{ label: "", percent: "" }];
    setPercentRowsState(fallbackRows);
    onChange(serializePercentRows(fallbackRows));
  };

  const parsedPercent = percentRowsState.length ? percentRowsState : parsePercentRows(value);
  const percentTotal = parsedPercent
    .map((row) => Number(row.percent))
    .filter((valueItem) => Number.isFinite(valueItem))
    .reduce((acc, valueItem) => acc + valueItem, 0);
  const structuredRows = structuredConfig
    ? (structuredRowsState.length ? structuredRowsState : parseStructuredRows(value, structuredConfig.columns.length))
    : [];

  return (
    <div className="space-y-3">
      {showMeta && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Input type: {expects}</span>
          <span>{helperText ?? "Use structured input where available."}</span>
        </div>
      )}

      {timezoneMode ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TIMEZONE_OPTIONS.map((tz) => (
            <button
              key={tz}
              type="button"
              disabled={loading}
              onClick={() => onChange(tz)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                value.trim() === tz ? "border-primary bg-primary/15" : "border-border bg-background/40"
              }`}
            >
              {tz}
            </button>
          ))}
        </div>
      ) : null}

      {numericMode ? (
        <Input
          id={inputId}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Enter a number"
        />
      ) : null}

      {percentMode && !numericMode ? (
        <div className="space-y-2">
          {parsedPercent.map((row, rowIndex) => (
            <div key={`percent-row-${rowIndex}`} className="grid grid-cols-[1fr_120px_auto] gap-2">
              <Input
                value={row.label ?? ""}
                placeholder="Label (e.g. English)"
                onBlur={() => setTouched(true)}
                onChange={(event) => updatePercentRow(rowIndex, "label", event.target.value)}
              />
              <Input
                value={row.percent ?? ""}
                type="number"
                placeholder="%"
                onBlur={() => setTouched(true)}
                onChange={(event) => updatePercentRow(rowIndex, "percent", event.target.value)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => removePercentRow(rowIndex)}>
                Remove
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addPercentRow}>
              Add row
            </Button>
            <div className={`text-xs ${percentTotal === 100 ? "text-emerald-400" : "text-amber-400"}`}>
              Total: {percentTotal}%
            </div>
          </div>
        </div>
      ) : null}

      {structuredConfig && !percentMode && !numericMode ? (
        <div className="space-y-2">
          {structuredRows.map((row, rowIndex) => (
            <div key={`structured-row-${rowIndex}`} className="rounded-lg border border-border p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {structuredConfig.columns.map((column, colIndex) => (
                  <Input
                    key={`${column}-${colIndex}`}
                    value={row[colIndex] ?? ""}
                    placeholder={column}
                    onBlur={() => setTouched(true)}
                    onChange={(event) => updateStructuredCell(rowIndex, colIndex, event.target.value)}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => removeStructuredRow(rowIndex)}>
                  Remove row
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addStructuredRow}>
            Add row
          </Button>
        </div>
      ) : null}

      {supportsGuidedInput ? <div className="text-xs text-muted-foreground">Manual answer (always available)</div> : null}
      <Textarea
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          setTouched(true);
          setIsFocused(false);
        }}
        onFocus={() => setIsFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            setTouched(true);
            if (!error && !loading) onSubmit();
          }
        }}
        placeholder="Type your response..."
        className={`resize-none transition-all duration-200 ${isExpanded ? "min-h-[150px]" : "min-h-[84px]"}`}
      />

      {validationRule || validationHelp ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/70">
          {validationRule ? <div><span className="font-semibold text-white/90">Validation:</span> {validationRule}</div> : null}
          {validationHelp ? <div className="mt-1"><span className="font-semibold text-white/90">Help:</span> {validationHelp}</div> : null}
          {validationExample ? <div className="mt-1"><span className="font-semibold text-white/90">Example:</span> {validationExample}</div> : null}
        </div>
      ) : null}

      {(touched || value.trim().length > 0) && error && <p className="text-sm text-destructive">{error}</p>}
      {(touched || value.trim().length > 0) && error && validationCode ? (
        <p className="text-xs text-destructive/90">Code: {validationCode}</p>
      ) : null}
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
