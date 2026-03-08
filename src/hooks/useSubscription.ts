import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import type { PlanType } from '@/lib/plan-limits';

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_end: string | null;
  storage_used: number;
  created_at: string;
  updated_at: string;
}

const subscriptionSyncPromises = new Map<string, Promise<void>>();

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const CHECK_SYNC_TTL_MS = 5 * 60 * 1000;

  const readLastSyncAt = () => {
    if (!user) return 0;
    try {
      const raw = sessionStorage.getItem(`subsync:${user.id}`);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  };

  const writeLastSyncAt = (value: number) => {
    if (!user) return;
    try {
      sessionStorage.setItem(`subsync:${user.id}`, String(value));
    } catch {
      // best-effort cache only
    }
  };

  const isTransientNetworkError = (error: unknown) => {
    const message = String((error as { message?: string })?.message ?? "");
    return (
      message.includes("Failed to send a request to the Edge Function") ||
      message.includes("TypeError: Failed to fetch") ||
      message.includes("ERR_ABORTED")
    );
  };

  const fetchSubscriptionRow = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (error) throw error;
    return (data as Subscription | null) ?? null;
  }, [user]);

  const ensureSubscriptionRow = useCallback(async () => {
    // If auth session isn't established yet, PostgREST will behave like anon and RLS will hide rows.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) return null;

    const existing = await fetchSubscriptionRow();
    if (existing) return existing;

    // Create "free" subscription for this user (idempotent via onConflict=user_id).
    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: user!.id,
          plan_type: 'free',
          status: 'active',
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      // If another process created it (e.g., edge function) treat as success and refetch.
      const msg = (upsertError as any)?.message ?? '';
      const code = (upsertError as any)?.code ?? '';
      if (code !== '23505' && !/duplicate key/i.test(msg)) throw upsertError;
    }

    return await fetchSubscriptionRow();
  }, [fetchSubscriptionRow, user]);

  const refreshSubscription = useCallback(async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      // Only call edge function if we have a valid token
      if (accessToken) {
        const lastSyncAt = readLastSyncAt();
        const shouldSyncRemote = Date.now() - lastSyncAt > CHECK_SYNC_TTL_MS;
        if (shouldSyncRemote) {
          const existingSync = subscriptionSyncPromises.get(user.id);
          if (existingSync) {
            await existingSync;
          } else {
            const syncPromise = (async () => {
              const { data, error } = await supabase.functions.invoke('check-subscription', {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });

              if (error) {
                if (!isTransientNetworkError(error)) {
                  console.error('[useSubscription] Error checking subscription:', error);
                }
              } else {
                writeLastSyncAt(Date.now());
                if (import.meta.env.DEV) {
                  console.debug('[useSubscription] Subscription check result:', data);
                }
              }
            })().finally(() => {
              subscriptionSyncPromises.delete(user.id);
            });
            subscriptionSyncPromises.set(user.id, syncPromise);
            await syncPromise;
          }
          if (readLastSyncAt() === 0) {
            // Prevent hot-loop retries across parallel mounts when sync failed transiently.
            writeLastSyncAt(Date.now());
          }
        }
      }

      const row = await ensureSubscriptionRow();
      if (row) setSubscription(row);
    } catch (err) {
      if (!isTransientNetworkError(err)) {
        console.error('[useSubscription] Error refreshing subscription:', err);
      }
    } finally {
      setRefreshing(false);
    }
  }, [ensureSubscriptionRow, user]);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const row = await ensureSubscriptionRow();
        if (row) setSubscription(row);

        // Refresh from Stripe on initial load
        await refreshSubscription();
      } catch (err) {
        if (!isTransientNetworkError(err)) {
          console.error('Error in fetchSubscription:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();

    // Subscribe to changes
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setSubscription(payload.new as unknown as Subscription);
          } else if (payload.eventType === 'DELETE') {
            setSubscription(null);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, refreshSubscription]);

  return { subscription, loading, refreshing, refreshSubscription };
}
