import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to detect and save user's timezone on first login
 * Only runs once if timezone is not already set
 */
export function useTimezoneDetection() {
  const { toast } = useToast();

  useEffect(() => {
    const detectAndSaveTimezone = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if timezone is already set
        const { data: profile } = await supabase
          .from('profiles')
          .select('timezone')
          .eq('id', user.id)
          .single();

        // If timezone is not set, detect and save
        if (!profile?.timezone) {
          const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          
          await supabase
            .from('profiles')
            .update({ timezone: detectedTimezone })
            .eq('id', user.id);

          console.log('Timezone auto-detected and saved:', detectedTimezone);
        }
      } catch (error) {
        console.error('Error detecting timezone:', error);
      }
    };

    detectAndSaveTimezone();
  }, []);
}
