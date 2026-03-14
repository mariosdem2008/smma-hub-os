// Strategy OS - Strategy Builder Button

import { Button } from '@/components/ui/button';
import { useStrategyOS } from '../StrategyOSContext';
import { useGenerateStrategy } from '@/hooks/useStrategyModules';
import { useAddHistoryEvent } from '@/hooks/useStrategyHistory';
import { STRATEGY_MODULES } from '@/lib/strategy/constants';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  const handleGenerate = async () => {
    try {
      const result = await generateStrategy.mutateAsync({ clientId, agencyId, strategyId });

      if (result?.mode === 'template') {
        for (const moduleDef of STRATEGY_MODULES) {
          await addHistoryEvent.mutateAsync({
            clientId,
            strategyId,
            moduleId: null,
            module: moduleDef.key,
            eventType: 'seeded',
            eventData: { source: 'template_fallback', reason: result.reason },
          });
        }

        toast.success('Template Draft created', {
          description: 'AI is unavailable, so we created a Template Draft for all 6 modules.',
        });
        return;
      }

      if (result?.mode === 'unknown') {
        const fallbackMessage =
          result.message ?? result.questions?.[0] ?? 'Strategy Builder is blocked. Resolve missing requirements and retry.';
        toast.error('Strategy Builder blocked', {
          description: fallbackMessage,
          action: result.deepLink
            ? {
                label: 'Fix now',
                onClick: () => navigate(result.deepLink!),
              }
            : undefined,
        });
        return;
      }

      toast.success('Strategy Builder complete', {
        description: 'Your strategy modules and document are ready to review.',
      });
    } catch (err) {
      toast.error('Failed to run Strategy Builder', {
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
          Building...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Strategy Builder
        </>
      )}
    </Button>
  );
}

export default GenerateStrategyButton;
