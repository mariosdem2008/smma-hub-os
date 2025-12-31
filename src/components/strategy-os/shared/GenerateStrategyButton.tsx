// Strategy OS - Generate Strategy Button

import { Button } from '@/components/ui/button';
import { useStrategyOS } from '../StrategyOSContext';
import { useGenerateStrategy } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import { STRATEGY_MODULES } from '@/lib/strategy/constants';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GenerateStrategyButtonProps {
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export function GenerateStrategyButton({
  size = 'default',
  variant = 'default',
  className,
}: GenerateStrategyButtonProps) {
  const { clientId, agencyId, strategyId } = useStrategyOS();
  const generateStrategy = useGenerateStrategy();
  const addHistoryEvent = useAddHistoryEvent();

  const handleGenerate = async () => {
    try {
      await generateStrategy.mutateAsync({ clientId, agencyId, strategyId });

      // Add history events for each module
      for (const moduleDef of STRATEGY_MODULES) {
        await addHistoryEvent.mutateAsync({
          clientId,
          strategyId,
          moduleId: null,
          module: moduleDef.key,
          eventType: 'seeded',
          eventData: { source: 'generate_strategy' },
        });
      }

      toast.success('Strategy generated successfully', {
        description: 'All 6 modules have been seeded with template content.',
      });
    } catch (err) {
      toast.error('Failed to generate strategy', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  return (
    <Button
      onClick={handleGenerate}
      disabled={generateStrategy.isPending || !strategyId}
      size={size}
      variant={variant}
      className={className}
    >
      {generateStrategy.isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Strategy
        </>
      )}
    </Button>
  );
}

export default GenerateStrategyButton;
