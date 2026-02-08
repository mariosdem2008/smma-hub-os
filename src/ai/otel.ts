import type { TaskType } from "./taskTypes.ts";
import { isOtelLoggingEnabled } from "./flags.ts";

export type OTelSpanInput = {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  stage: string;
  taskType: TaskType;
  agencyId?: string | null;
  clientId?: string | null;
  userId?: string | null;
  latencyMs?: number;
  attributes?: Record<string, unknown>;
};

type MinimalSupabase = {
  from: (table: string) => any;
};

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  const cryptoObj = (globalThis as any).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    cryptoObj.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i += 1) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateTraceId(): string {
  return randomHex(16);
}

export function generateSpanId(): string {
  return randomHex(8);
}

export async function logOtelSpan(supabase: MinimalSupabase | null | undefined, span: OTelSpanInput) {
  if (!supabase || !isOtelLoggingEnabled()) return;
  await supabase.from("ai_otel_spans").insert({
    trace_id: span.traceId,
    span_id: span.spanId,
    parent_span_id: span.parentSpanId ?? null,
    stage: span.stage,
    task_type: span.taskType,
    agency_id: span.agencyId ?? null,
    client_id: span.clientId ?? null,
    user_id: span.userId ?? null,
    latency_ms: span.latencyMs ?? null,
    attributes: span.attributes ?? {},
  });
}
