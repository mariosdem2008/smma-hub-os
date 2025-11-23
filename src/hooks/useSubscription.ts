import { useEffect, useState } from 'react';
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

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching subscription:', error);
          // Create default free subscription if doesn't exist
          const { data: newSub, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              plan_type: 'free',
              status: 'active',
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating subscription:', insertError);
          } else {
            setSubscription(newSub as Subscription);
          }
        } else {
          setSubscription(data as Subscription);
        }
      } catch (err) {
        console.error('Error in fetchSubscription:', err);
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
  }, [user]);

  return { subscription, loading };
}
