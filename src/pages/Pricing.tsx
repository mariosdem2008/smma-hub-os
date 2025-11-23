import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'Freemium',
      price: 'Free',
      description: 'Perfect for getting started',
      type: 'free' as const,
      features: [
        '1 client workspace',
        '3 team members',
        'Unlimited scheduled posts',
        'All tools unlocked',
        'Analytics (7 days)',
        'Max 200MB per file',
      ],
      cta: subscription?.plan_type === 'free' ? 'Current Plan' : 'Get Started',
      popular: false,
    },
    {
      name: 'Starter',
      price: billingInterval === 'monthly' ? '€29' : '€290',
      interval: billingInterval === 'monthly' ? '/month' : '/year',
      description: 'For growing agencies',
      type: 'starter' as const,
      features: [
        'Up to 3 clients',
        'Up to 5 team members',
        '100GB storage',
        'Full analytics',
        'Bulk scheduling',
        'Templates library',
      ],
      cta: 'Upgrade to Starter',
      popular: false,
    },
    {
      name: 'Pro',
      price: billingInterval === 'monthly' ? '€59' : '€590',
      interval: billingInterval === 'monthly' ? '/month' : '/year',
      description: 'Most popular choice',
      type: 'pro' as const,
      features: [
        'Up to 10 clients',
        'Up to 10 team members',
        '500GB storage',
        'White-label',
        'Approval workflows',
        'All AI tools',
      ],
      cta: 'Upgrade to Pro',
      popular: true,
    },
    {
      name: 'Agency Plus',
      price: billingInterval === 'monthly' ? '€129' : '€1290',
      interval: billingInterval === 'monthly' ? '/month' : '/year',
      description: 'For established agencies',
      type: 'agency_plus' as const,
      features: [
        'Unlimited clients',
        'Unlimited team members',
        '2TB storage',
        'Advanced automation',
        'Multi-admin',
        'Dedicated support',
      ],
      cta: 'Upgrade to Agency Plus',
      popular: false,
    },
  ];

  const handleSelectPlan = async (planType: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (planType === 'free') {
      toast.info('You are already on the free plan');
      return;
    }

    if (subscription?.plan_type === planType) {
      toast.info('This is your current plan');
      return;
    }

    try {
      toast.loading('Creating checkout session...');
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          planType, 
          billingInterval 
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Scale your social media agency with the right plan
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Button
              variant={billingInterval === 'monthly' ? 'default' : 'ghost'}
              onClick={() => setBillingInterval('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={billingInterval === 'yearly' ? 'default' : 'ghost'}
              onClick={() => setBillingInterval('yearly')}
            >
              Yearly
              <Badge variant="secondary" className="ml-2">Save 17%</Badge>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.type}
              className={`relative ${plan.popular ? 'border-primary shadow-xl scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="px-3 py-1">
                    <Zap className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.interval && (
                    <span className="text-muted-foreground">{plan.interval}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(plan.type)}
                  disabled={subscription?.plan_type === plan.type}
                >
                  {subscription?.plan_type === plan.type ? 'Current Plan' : plan.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
