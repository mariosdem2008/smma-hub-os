// src/data/supabase.ts
import type { PostgrestError, SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getActiveAgencyId } from "@/lib/active-agency";

// Re-export db from the existing Supabase client
export const db = supabase as SupabaseClient<Database>;
export type { Database };

// Normalized error type for UI
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
      code: (e as { code?: string }).code,
      message: e.message || fallback,
      details: (e as { details?: string }).details ?? null,
      hint: (e as { hint?: string }).hint ?? null,
      status: (e as { status?: number }).status,
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

/**
 * Supabase PostgREST builders are "thenables" (awaitable) but not typed as Promise.
 * So wrappers must accept PromiseLike.
 */
export type SupaThenable<T> = PromiseLike<{ data: T | null; error: PostgrestError | null }>;

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

export async function safeList<T>(q: SupaThenable<T[]>, msg?: string): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw toDbError(error, msg ?? "Request failed");
  return data ?? [];
}

export async function requireUser(): Promise<User> {
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw toDbError(error ?? new Error("Not authenticated"), "Not authenticated");
  return data.user;
}

// Agency context (owner or member) with caching
type AgencyContext = {
  agencyId: string;
  isOwner: boolean;
  role: "owner" | "admin" | "manager" | "member";
};

let cachedAgencyCtx: { userId: string; activeAgencyId: string | null; ctx: AgencyContext } | null = null;

export async function getAgencyContextForUser(userId: string): Promise<AgencyContext> {
  const activeAgencyId = getActiveAgencyId();
  if (cachedAgencyCtx?.userId === userId && cachedAgencyCtx.activeAgencyId === activeAgencyId) {
    return cachedAgencyCtx.ctx;
  }

  const { data: ownedAgency, error: ownedErr } = await db
    .from("agencies")
    .select("id,user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (ownedErr) throw toDbError(ownedErr);

  const { data: members, error: memberErr } = await db
    .from("agency_members")
    .select("agency_id,role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (memberErr) throw toDbError(memberErr);

  const membershipList: Array<{ agencyId: string; role: AgencyContext["role"]; isOwner: boolean }> = [];
  if (ownedAgency?.id) {
    membershipList.push({ agencyId: ownedAgency.id, role: "owner", isOwner: true });
  }
  for (const m of members ?? []) {
    membershipList.push({
      agencyId: m.agency_id,
      role: (m.role as AgencyContext["role"]) ?? "member",
      isOwner: false,
    });
  }

  const unique = new Map<string, (typeof membershipList)[number]>();
  for (const m of membershipList) {
    const existing = unique.get(m.agencyId);
    if (!existing) unique.set(m.agencyId, m);
    else if (m.isOwner && !existing.isOwner) unique.set(m.agencyId, m);
  }
  const memberships = [...unique.values()];

  if (memberships.length === 0) {
    throw { message: "No agency membership found for this user" } satisfies DbError;
  }

  const selected =
    (activeAgencyId && memberships.find((m) => m.agencyId === activeAgencyId)) ||
    (memberships.length === 1 ? memberships[0] : null);

  if (!selected) {
    throw { message: "Multiple agencies found; select an agency first" } satisfies DbError;
  }

  const ctx: AgencyContext = { agencyId: selected.agencyId, isOwner: selected.isOwner, role: selected.role };
  cachedAgencyCtx = { userId, activeAgencyId, ctx };
  return ctx;
}

export async function getMyAgencyContext(): Promise<AgencyContext> {
  const user = await requireUser();
  return getAgencyContextForUser(user.id);
}

export function clearAgencyContextCache() {
  cachedAgencyCtx = null;
}
