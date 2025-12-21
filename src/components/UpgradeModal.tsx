import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Sparkles, Zap, ArrowRight, Star, Flame, Lock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PLAN_NAMES } from '@/lib/plan-limits';
import type { PlanType } from '@/lib/plan-limits';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
  suggestedPlan?: PlanType;
}

export function UpgradeModal({ open, onOpenChange, feature, suggestedPlan }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const { role, isOwner } = useRole();
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [upgrading, setUpgrading] = useState(false);

  // Auto-select plan based on current subscription
  const getPreselectedPlan = (): PlanType => {
    if (suggestedPlan) return suggestedPlan;
    if (!subscription) return 'pro';
    
    switch (subscription.plan_type) {
      case 'free':
      case 'starter':
        return 'pro';
      case 'pro':
        return 'agency_plus';
      default:
        return 'pro';
    }
  };

  const preselectedPlan = getPreselectedPlan();
  const currentPlan = selectedPlan || preselectedPlan;

  const handleUpgrade = async (planType: PlanType) => {
    if (planType === 'free') return;
    
    // Role-based access control
    if (!isOwner) {
      if (role === 'admin') {
        toast.error('Only the agency owner can upgrade the plan.');
      } else {
        toast.error('Contact your agency owner to upgrade the plan.');
      }
      return;
    }
    
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planType, billingInterval },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        onOpenChange(false);
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const plans = [
    {
      name: 'Freemium',
      price: 'Free',
      type: 'free' as const,
      disabled: true,
      features: ['1 client', '3 team members', 'Unlimited posts', '7-day analytics', 'Max 200MB per file'],
    },
    {
      name: 'Starter',
      price: billingInterval === 'monthly' ? '€199' : '€1990',
      interval: billingInterval === 'monthly' ? '/mo' : '/yr',
      type: 'starter' as const,
      features: ['3 clients', '5 team members', '100GB storage', 'Full analytics', 'Bulk scheduling', 'Templates'],
    },
    {
      name: 'Pro',
      price: billingInterval === 'monthly' ? '€399' : '€3990',
      interval: billingInterval === 'monthly' ? '/mo' : '/yr',
      type: 'pro' as const,
      popular: true,
      features: ['10 clients', '10 team members', '500GB storage', 'White-label', 'Approval workflows', 'All AI tools'],
    },
    {
      name: 'Agency Plus',
      price: billingInterval === 'monthly' ? '€799' : '€7990',
      interval: billingInterval === 'monthly' ? '/mo' : '/yr',
      type: 'agency_plus' as const,
      features: ['Unlimited clients', 'Unlimited members', '2TB storage', 'Advanced automation', 'Multi-admin', 'Dedicated support'],
    },
  ];

  const featureComparison = [
    { name: 'Clients', free: '1', starter: '3', pro: '10', agency: '∞' },
    { name: 'Team Members', free: '3', starter: '5', pro: '10', agency: '∞' },
    { name: 'Storage', free: '10GB', starter: '100GB', pro: '500GB', agency: '2TB' },
    { name: 'Analytics', free: '7 days', starter: 'Full', pro: 'Full', agency: 'Full' },
    { name: 'White-label', free: '✗', starter: '✗', pro: '✓', agency: '✓' },
    { name: 'Bulk Scheduling', free: '✗', starter: '✓', pro: '✓', agency: '✓' },
    { name: 'Approval Workflows', free: '✗', starter: '✗', pro: '✓', agency: '✓' },
    { name: 'Premium AI Tools', free: '✗', starter: '✓', pro: '✓', agency: '✓' },
    { name: 'Multi-admin', free: '✗', starter: '✗', pro: '✗', agency: '✓' },
    { name: 'Dedicated Support', free: '✗', starter: '✗', pro: '✗', agency: '✓' },
  ];

  const testimonials = [
    { quote: "SMMAHUB transformed how we manage our 50+ clients. The Pro plan is worth every penny.", author: "Sarah K., Agency Owner" },
    { quote: "Upgraded to Agency Plus and never looked back. The automation alone saves us 20 hours per week.", author: "Mike R., Marketing Director" },
    { quote: "Best investment for our agency. The white-label feature makes us look even more professional.", author: "Lisa M., Social Media Manager" },
  ];

  // Role-based messaging
  const getRoleMessage = () => {
    if (isOwner) return null;
    if (role === 'admin') {
      return (
        <Alert className="border-primary/20 bg-primary/5">
          <Lock className="h-4 w-4 text-primary" />
          <AlertDescription>
            You can view pricing information, but only the agency owner can complete the upgrade process.
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <Alert className="border-primary/20 bg-primary/5">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertDescription>
          Contact your agency owner to request a plan upgrade. You'll be able to access these features once they upgrade.
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="text-3xl flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Upgrade Your Plan
          </DialogTitle>
          <DialogDescription className="text-base">
            {feature
              ? `"${feature}" is available on higher plans. Choose the perfect plan for your agency.`
              : 'Scale your agency with the right plan for your needs.'}
          </DialogDescription>
        </DialogHeader>

        {getRoleMessage()}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 py-4">
          <Button
            variant={billingInterval === 'monthly' ? 'default' : 'ghost'}
            onClick={() => setBillingInterval('monthly')}
            size="sm"
          >
            Monthly
          </Button>
          <Button
            variant={billingInterval === 'yearly' ? 'default' : 'ghost'}
            onClick={() => setBillingInterval('yearly')}
            size="sm"
          >
            Yearly
            <Badge variant="secondary" className="ml-2">Save 17%</Badge>
          </Button>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-4 gap-4 py-4">
          {plans.map((plan) => (
            <Card
              key={plan.type}
              className={`relative transition-all ${
                currentPlan === plan.type ? 'border-primary shadow-xl ring-2 ring-primary' : ''
              } ${plan.popular ? 'scale-105' : ''} ${plan.disabled ? 'opacity-60' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="px-3 py-1">
                    <Zap className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="text-2xl font-bold">
                  {plan.price}
                  {plan.interval && (
                    <span className="text-sm font-normal text-muted-foreground">{plan.interval}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {plan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-xs">{feat}</span>
                  </div>
                ))}
                <Button
                  className="w-full mt-4"
                  variant={currentPlan === plan.type ? 'default' : 'outline'}
                  onClick={() => !plan.disabled && handleUpgrade(plan.type)}
                  disabled={plan.disabled || upgrading || subscription?.plan_type === plan.type || !isOwner}
                >
                  {subscription?.plan_type === plan.type 
                    ? 'Current Plan' 
                    : plan.disabled 
                    ? 'Current' 
                    : !isOwner 
                    ? (role === 'admin' ? 'Owner Only' : 'Contact Owner')
                    : 'Upgrade Now'}
                  {!plan.disabled && subscription?.plan_type !== plan.type && isOwner && (
                    <ArrowRight className="ml-2 h-4 w-4" />
                  )}
                  {!isOwner && !plan.disabled && <Lock className="ml-2 h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-6" />

        {/* Feature Comparison Table */}
        <div>
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Feature Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Feature</th>
                  <th className="text-center py-2 font-medium">Free</th>
                  <th className="text-center py-2 font-medium">Starter</th>
                  <th className="text-center py-2 font-medium">Pro</th>
                  <th className="text-center py-2 font-medium">Agency Plus</th>
                </tr>
              </thead>
              <tbody>
                {featureComparison.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 font-medium">{row.name}</td>
                    <td className="text-center py-2">{row.free}</td>
                    <td className="text-center py-2">{row.starter}</td>
                    <td className="text-center py-2">{row.pro}</td>
                    <td className="text-center py-2">{row.agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Testimonials */}
        <div>
          <h3 className="text-xl font-semibold mb-4">What Our Customers Say</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {testimonials.map((testimonial, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6">
                  <p className="text-sm italic mb-3">"{testimonial.quote}"</p>
                  <p className="text-xs font-medium text-muted-foreground">— {testimonial.author}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
