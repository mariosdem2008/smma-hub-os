import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLAN_NAMES, PLAN_PRICES } from '@/lib/plan-limits';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  requiredPlan?: 'starter' | 'pro' | 'agency_plus';
}

export function UpgradeModal({ open, onOpenChange, feature, requiredPlan = 'starter' }: UpgradeModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  const plans = [
    {
      name: 'Starter',
      price: '€29',
      type: 'starter' as const,
      features: ['3 clients', '5 team members', '100GB storage', 'Bulk scheduling', 'Templates'],
    },
    {
      name: 'Pro',
      price: '€59',
      type: 'pro' as const,
      popular: true,
      features: ['10 clients', '10 team members', '500GB storage', 'White-label', 'Approval workflows'],
    },
    {
      name: 'Agency Plus',
      price: '€129',
      type: 'agency_plus' as const,
      features: ['Unlimited clients', 'Unlimited members', 'Unlimited storage', 'Multi-admin', 'Dedicated support'],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Upgrade Your Plan
          </DialogTitle>
          <DialogDescription>
            {feature
              ? `"${feature}" requires ${PLAN_NAMES[requiredPlan]} or higher.`
              : 'Unlock more features and scale your agency.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4 py-4">
          {plans.map((plan) => (
            <Card
              key={plan.type}
              className={plan.popular ? 'border-primary shadow-lg' : ''}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 text-center rounded-t-lg">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold">
                  {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span className="text-sm">{feat}</span>
                  </div>
                ))}
                <Button
                  className="w-full mt-4"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={handleUpgrade}
                >
                  Choose {plan.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
