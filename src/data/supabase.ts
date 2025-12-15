// src/data/supabase.ts
import type { PostgrestError, SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// 1) Re-export your generated client, but from a single stable entry-point
export const db = supabase as SupabaseClient<Database>;
export type { Database };

// 2) Normalized error (so UI can show 1 clean message)
export type DbError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
};

export function toDbError(err: unknown, fallback = "Database error"): DbError {
  if (!err) return { message: fallback };

  // PostgrestError shape
  const e = err as Partial<PostgrestError> & { status?: number; message?: string };
  if (typeof e.message === "string") {
    return {
      code: (e as any).code,
      message: e.message || fallback,
      details: (e as any).details ?? null,
      hint: (e as any).hint ?? null,
      status: (e as any).status,
    };
  }

  if (err instanceof Error) return { message: err.message || fallback };
  return { message: fallback };
}

export function isPermissionError(err: unknown): boolean {
  const e = toDbError(err);
  // 42501 = insufficient_privilege (Postgres)
  // 403 often returned by PostgREST when RLS denies
  return e.code === "42501" || e.status === 403 || /permission denied/i.test(e.message);
}

export async function requireUser(): Promise<User> {
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw toDbError(error ?? new Error("Not authenticated"), "Not authenticated");
  return data.user;
}

// 3) Agency context (owner or member) – cached in-memory per session
type AgencyContext = {
  agencyId: string;
  isOwner: boolean;
  role: "owner" | "admin" | "manager" | "creator" | "viewer" | "member";
};

let cachedAgencyCtx: { userId: string; ctx: AgencyContext } | null = null;

export async function getAgencyContextForUser(userId: string): Promise<AgencyContext> {
  if (cachedAgencyCtx?.userId === userId) return cachedAgencyCtx.ctx;

  // 1) Owner path
  const { data: agency, error: agencyErr } = await db
    .from("agencies")
    .select("id,user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (agencyErr) throw toDbError(agencyErr);

  if (agency?.id) {
    const ctx: AgencyContext = { agencyId: agency.id, isOwner: true, role: "owner" };
    cachedAgencyCtx = { userId, ctx };
    return ctx;
  }

  // 2) Member path
  const { data: member, error: memberErr } = await db
    .from("agency_members")
    .select("agency_id,role")
    .eq("user_id", userId)
    .maybeSingle();

  if (memberErr) throw toDbError(memberErr);

  if (!member?.agency_id) {
    throw { message: "No agency membership found for this user" } satisfies DbError;
  }

  const ctx: AgencyContext = {
    agencyId: member.agency_id,
    isOwner: false,
    role: (member.role as AgencyContext["role"]) ?? "member",
  };
  cachedAgencyCtx = { userId, ctx };
  return ctx;
}

export async function getMyAgencyContext(): Promise<AgencyContext> {
  const user = await requireUser();
  return getAgencyContextForUser(user.id);
}

export function clearAgencyContextCache() {
  cachedAgencyCtx = null;
}

// 4) Small helpers for common patterns
export async function safeSingle<T>(p: Promise<{ data: T | null; error: any }>, msg?: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw toDbError(error, msg);
  if (!data) throw { message: msg ?? "Record not found" } satisfies DbError;
  return data;
}

export async function safeMaybeSingle<T>(
  p: Promise<{ data: T | null; error: any }>,
  msg?: string
): Promise<T | null> {
  const { data, error } = await p;
  if (error) throw toDbError(error, msg);
  return data ?? null;
}
