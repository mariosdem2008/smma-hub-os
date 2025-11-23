import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Sparkles } from 'lucide-react';
import { useUpgradeAssistant } from '@/contexts/UpgradeAssistantContext';
import { useUpgradeModal } from '@/contexts/UpgradeModalContext';
import { useSubscription } from '@/hooks/useSubscription';
import { getAssistantMessage } from '@/lib/upgrade-assistant-messages';
import { PLAN_NAMES } from '@/lib/plan-limits';

export function UpgradeAssistantCard() {
  const { isCardOpen, closeAssistantCard, currentReason } = useUpgradeAssistant();
  const { openUpgradeModal } = useUpgradeModal();
  const { subscription } = useSubscription();

  if (!isCardOpen || !currentReason || !subscription) return null;

  const message = getAssistantMessage(currentReason, subscription.plan_type);

  const handleUpgrade = () => {
    closeAssistantCard();
    openUpgradeModal({ suggestedPlan: message.recommendedPlan });
    console.log('[Upgrade Assistant] Upgrade clicked');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={closeAssistantCard} />
      <Card className="relative z-10 w-full max-w-md shadow-xl animate-scale-in">
        <button
          onClick={closeAssistantCard}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <Badge variant="secondary">Personalized for you</Badge>
          </div>
          <CardTitle className="text-xl">{message.title}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message.message}</p>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-sm">
              Recommended: {PLAN_NAMES[message.recommendedPlan]}
            </p>
            {message.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleUpgrade} className="flex-1">
              See Upgrade Options
            </Button>
            <Button onClick={closeAssistantCard} variant="ghost">
              Maybe Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
