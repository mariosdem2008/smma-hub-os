// src/data/supabase.ts
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const db = supabase;

export type DbError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  raw?: unknown;
};

export function toDbError(err: any, fallback = "Database error"): DbError {
  if (!err) return { message: fallback };
  if (typeof err === "string") return { message: err };

  return {
    message: err.message ?? fallback,
    code: err.code ?? err.sqlstate ?? undefined,
    details: err.details ?? null,
    hint: err.hint ?? null,
    raw: err,
  };
}

/**
 * Supabase PostgREST builders are "thenables" (awaitable) but not typed as Promise.
 * So wrappers must accept PromiseLike.
 */
export type SupaThenable<T> = PromiseLike<{ data: T | null; error: any }>;

export async function safeSingle<T>(q: SupaThenable<T>, msg?: string): Promise<T> {
  const { data, error } = await q;
  if (error) throw toDbError(error, msg ?? "Request failed");
  if (data === null || data === undefined) throw { message: msg ?? "Record not found" } satisfies DbError;
  return data;
}

export async function safeMaybeSingle<T>(q: SupaThenable<T>, msg?: string): Promise<T | null> {
  const { data, error } = await q;
  if (error) throw toDbError(error, msg ?? "Request failed");
  return data ?? null;
}

export async function requireUser(): Promise<User> {
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw toDbError(error, "Not authenticated");
  return data.user;
}

export async function getMyAgencyContext(): Promise<{
  agencyId: string;
  isOwner: boolean;
}> {
  const user = await requireUser();

  // 1) owner path: agencies.user_id === auth.user.id
  const ownerAgency = await safeMaybeSingle(
    db.from("agencies").select("id").eq("user_id", user.id).maybeSingle(),
    "Failed to load agency (owner)"
  );

  if (ownerAgency?.id) {
    return { agencyId: ownerAgency.id, isOwner: true };
  }

  // 2) member path: agency_members.user_id === auth.user.id
  const member = await safeMaybeSingle(
    db.from("agency_members").select("agency_id").eq("user_id", user.id).maybeSingle(),
    "Failed to load agency (member)"
  );

  if (member?.agency_id) {
    return { agencyId: member.agency_id, isOwner: false };
  }

  throw { message: "No agency membership found" } satisfies DbError;
}
