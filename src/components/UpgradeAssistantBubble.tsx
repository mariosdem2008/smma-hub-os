import { Sparkles } from 'lucide-react';
import { useUpgradeAssistant } from '@/contexts/UpgradeAssistantContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function UpgradeAssistantBubble() {
  const { isBubbleVisible, isPulsing, openAssistantCard } = useUpgradeAssistant();
  const { subscription } = useSubscription();

  // Only show for free, starter, and ltd_starter users
  const shouldShow = subscription && ['free', 'starter', 'ltd_starter'].includes(subscription.plan_type);

  if (!shouldShow || !isBubbleVisible) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={openAssistantCard}
            className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-all hover:scale-110 flex items-center justify-center ${
              isPulsing ? 'animate-pulse' : ''
            }`}
            style={{
              animation: isPulsing ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
            }}
          >
            <Sparkles className="h-6 w-6" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Upgrade Assistant</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
