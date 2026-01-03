
import { 
  Loader2, 
  CreditCard, 
  Users, 
  FolderOpen, 
  Building2, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  TrendingUp,
  Zap,
  Crown,
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  ExternalLink,
  Info,
  AlertCircle,
  Receipt,
  Activity,
  BarChart3,
  Infinity as InfinityIcon,
  Lock,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { NoPermissionModal } from '../components/billing/NoPermissionModal.tsx';
import { Button } from '../components/ui/button.tsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card.tsx';
import { Separator } from '../components/ui/separator.tsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.tsx';
import { usePlanLimits } from '../hooks/usePlanLimits.ts';
import { useRole } from '../hooks/useRole.ts';
import { useSubscription } from '../hooks/useSubscription.ts';
import { supabase } from '../integrations/supabase/client.ts';
import { getNextPlan, canUpgrade, PLAN_PRICES, PLAN_NAMES, formatStorageSize } from '../lib/plan-limits.ts';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge.tsx';

export default function Billing() {
  const navigate = useNavigate();
  const { subscription, loading, refreshSubscription } = useSubscription();
  const { limits } = usePlanLimits();
  const { role, loading: roleLoading, isOwner } = useRole();
  const [usage, setUsage] = useState({ clients: 0, teamMembers: 0 });
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [showNoPermission, setShowNoPermission] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Check URL params for successful checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' || params.get('checkout') === 'success') {
      console.log('[Billing] Checkout success detected, refreshing subscription');
      refreshSubscription();
      window.history.replaceState({}, '', '/billing');
    }
  }, [refreshSubscription]);

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error opening customer portal:', error);
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error managing subscription:', err);
    } finally {
      setManagingSubscription(false);
    }
  };

  useEffect(() => {
    const fetchUsage = async () => {
      if (!subscription) return;

      try {
        const { data: membership } = await supabase
          .from('agency_members')
          .select('agency_id')
          .eq('user_id', subscription.user_id)
          .single();

        if (!membership) return;

        const { count: clientCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', membership.agency_id);

        const { count: memberCount } = await supabase
          .from('agency_members')
          .select('*', { count: 'exact', head: true })
          .eq('agency_id', membership.agency_id);

        setUsage({
          clients: clientCount || 0,
          teamMembers: memberCount || 0,
        });
      } catch (error) {
        console.error('Error fetching usage:', error);
      } finally {
        setLoadingUsage(false);
      }
    };

    fetchUsage();
  }, [subscription]);

  useEffect(() => {
    if (!roleLoading && !isOwner) {
      if (role === 'admin') {
        navigate('/billing/overview', { replace: true });
      } else {
        setShowNoPermission(true);
      }
    }
  }, [roleLoading, isOwner, role, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </motion.div>
      </div>
    );
  }

  if (showNoPermission) {
    return (
      <NoPermissionModal
        open={showNoPermission}
        onOpenChange={(open) => {
          setShowNoPermission(open);
          if (!open) navigate('/dashboard', { replace: true });
        }}
      />
    );
  }

  if (!subscription) {
    return (
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>No Subscription Found</CardTitle>
              <CardDescription>Please contact support if you believe this is an error.</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    );
  }

  const storagePercent = limits?.storage
    ? Math.round((subscription.storage_used / limits.storage) * 100)
    : 0;

  const clientPercent = limits?.clients
    ? Math.round((usage.clients / limits.clients) * 100)
    : 0;

  const memberPercent = limits?.teamMembers
    ? Math.round((usage.teamMembers / limits.teamMembers) * 100)
    : 0;

  const isActive = subscription.status === 'active';
  const isLifetime = subscription.plan_type.startsWith('ltd');
  const nextPlan = getNextPlan(subscription.plan_type);
  const hasUpgrade = canUpgrade(subscription.plan_type);
  
  const currentPrice = subscription.plan_type !== 'free' 
    ? PLAN_PRICES[subscription.plan_type as keyof typeof PLAN_PRICES]
    : null;

  const daysUntilRenewal = subscription.current_period_end
    ? differenceInDays(new Date(subscription.current_period_end), new Date())
    : null;

  const quintOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: quintOut,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-surface/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Premium Header */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-accent/30 blur-2xl rounded-full animate-pulse" />
                  <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 p-4 rounded-2xl border-2 border-primary/30 shadow-lg shadow-primary/20">
                    <CreditCard className="h-8 w-8 text-primary" />
                  </div>
                </motion.div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent mb-2">
                    Billing & Subscription
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    Manage your subscription, usage, and billing preferences
                  </p>
                </div>
              </div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Badge 
                  variant="secondary" 
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-primary/15 to-accent/15 border-2 border-primary/30 shadow-md"
                >
                  <Shield className="h-4 w-4 text-primary" />
                  Owner Access
                </Badge>
              </motion.div>
            </div>

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/50 border border-border/50 p-1.5 h-auto">
                <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Activity className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="billing" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Receipt className="h-4 w-4 mr-2" />
                  Billing
                </TabsTrigger>
                <TabsTrigger value="payment" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Current Plan - Hero Card */}
              <motion.div variants={itemVariants}>
                <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-card via-card/95 to-card/90 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                  
                  <CardHeader className="relative z-10 pb-4">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ 
                              rotate: [0, 5, -5, 0],
                              scale: [1, 1.05, 1],
                            }}
                            transition={{ 
                              duration: 4,
                              repeat: Infinity,
                              repeatDelay: 3,
                            }}
                          >
                            <Crown className="h-7 w-7 text-primary" />
                          </motion.div>
                          <div>
                            <CardTitle className="text-3xl mb-1">Current Plan</CardTitle>
                            <CardDescription className="text-base flex items-center gap-2 mt-2">
                              {isLifetime ? (
                                <>
                                  <Sparkles className="h-4 w-4 text-primary" />
                                  <span>Lifetime access - no recurring billing</span>
                                </>
                              ) : subscription.current_period_end ? (
                                <>
                                  <Calendar className="h-4 w-4" />
                                  <span>Renews {daysUntilRenewal !== null && daysUntilRenewal > 0 ? `in ${daysUntilRenewal} days` : 'today'}</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span>{format(new Date(subscription.current_period_end), 'MMM d, yyyy')}</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="h-4 w-4" />
                                  <span>No billing date set</span>
                                </>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-3">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Badge 
                            variant="default" 
                            className="text-xl px-6 py-2.5 bg-gradient-to-r from-primary via-primary/90 to-primary/80 shadow-lg shadow-primary/40 border-2 border-primary/50"
                          >
                            {PLAN_NAMES[subscription.plan_type]}
                          </Badge>
                        </motion.div>
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.3, type: 'spring' }}
                        >
                          <Badge 
                            variant={isActive ? 'default' : 'destructive'}
                            className={`flex items-center gap-1.5 px-4 py-1.5 ${
                              isActive 
                                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-2 border-green-500/40 shadow-md' 
                                : ''
                            }`}
                          >
                            {isActive ? (
                              <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </motion.div>
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                          </Badge>
                        </motion.div>
                        {currentPrice && (
                          <div className="pt-2">
                            <div className="text-3xl font-bold">
                              €{currentPrice.monthly}
                              <span className="text-lg font-normal text-muted-foreground">/mo</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="relative z-10 pt-6">
                    <div className="flex flex-wrap gap-3">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button 
                          onClick={() => navigate('/pricing')} 
                          className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/40 border-2 border-primary/50"
                          size="lg"
                        >
                          <Zap className="mr-2 h-5 w-5" />
                          Change Plan
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </motion.div>
                      {subscription.stripe_customer_id && (
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button 
                            variant="outline" 
                            onClick={handleManageSubscription}
                            disabled={managingSubscription}
                            size="lg"
                            className="border-2 hover:bg-primary/10 hover:border-primary/50"
                          >
                            {managingSubscription ? (
                              <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Opening...
                              </>
                            ) : (
                              <>
                                <CreditCard className="mr-2 h-5 w-5" />
                                Manage Subscription
                              </>
                            )}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Usage Statistics Grid */}
              <motion.div variants={itemVariants}>
                <Card className="border-2 border-primary/20 shadow-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
                          <BarChart3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Usage & Limits</CardTitle>
                          <CardDescription className="text-base mt-1">
                            Monitor your resource consumption and plan limits
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-6">
                    {/* Clients */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 shadow-md">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg">Clients</div>
                            <p className="text-sm text-muted-foreground">Active client accounts</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold">
                            {loadingUsage ? (
                              <Loader2 className="h-6 w-6 animate-spin inline" />
                            ) : (
                              usage.clients
                            )}
                          </div>
                          <div className="text-muted-foreground text-sm mt-1">
                            {limits?.clients ? `/ ${limits.clients}` : <InfinityIcon className="h-4 w-4 inline" />}
                          </div>
                        </div>
                      </div>
                      {limits?.clients && (
                        <>
                          <div className="relative h-4 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(clientPercent, 100)}%` }}
                              transition={{ duration: 1.5, delay: 0.5, ease: quintOut }}
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-full shadow-lg shadow-primary/40"
                            />
                            {clientPercent > 80 && (
                              <motion.div
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                              />
                            )}
                          </div>
                          {clientPercent > 80 && (
                            <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                              <AlertCircle className="h-4 w-4" />
                              <span>Approaching limit - consider upgrading</span>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>

                    <Separator className="bg-border/50" />

                    {/* Team Members */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 border-2 border-accent/30 shadow-md">
                            <Users className="h-6 w-6 text-accent" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg">Team Members</div>
                            <p className="text-sm text-muted-foreground">Active team collaborators</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold">
                            {loadingUsage ? (
                              <Loader2 className="h-6 w-6 animate-spin inline" />
                            ) : (
                              usage.teamMembers
                            )}
                          </div>
                          <div className="text-muted-foreground text-sm mt-1">
                            {limits?.teamMembers ? `/ ${limits.teamMembers}` : <InfinityIcon className="h-4 w-4 inline" />}
                          </div>
                        </div>
                      </div>
                      {limits?.teamMembers && (
                        <>
                          <div className="relative h-4 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(memberPercent, 100)}%` }}
                              transition={{ duration: 1.5, delay: 0.6, ease: quintOut }}
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent via-accent/90 to-accent/80 rounded-full shadow-lg shadow-accent/40"
                            />
                            {memberPercent > 80 && (
                              <motion.div
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                              />
                            )}
                          </div>
                          {memberPercent > 80 && (
                            <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                              <AlertCircle className="h-4 w-4" />
                              <span>Approaching limit - consider upgrading</span>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>

                    <Separator className="bg-border/50" />

                    {/* Storage */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-2 border-purple-500/30 shadow-md">
                            <FolderOpen className="h-6 w-6 text-purple-400" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg">Storage</div>
                            <p className="text-sm text-muted-foreground">File storage capacity</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {formatStorageSize(subscription.storage_used)}
                          </div>
                          <div className="text-muted-foreground text-sm mt-1">
                            {limits?.storage ? `/ ${formatStorageSize(limits.storage)}` : <InfinityIcon className="h-4 w-4 inline" />}
                          </div>
                        </div>
                      </div>
                      {limits?.storage && (
                        <>
                          <div className="relative h-4 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(storagePercent, 100)}%` }}
                              transition={{ duration: 1.5, delay: 0.7, ease: quintOut }}
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 via-purple-400 to-purple-300 rounded-full shadow-lg shadow-purple-500/40"
                            />
                            {storagePercent > 80 && (
                              <motion.div
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                              />
                            )}
                          </div>
                          {storagePercent > 80 && (
                            <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                              <AlertCircle className="h-4 w-4" />
                              <span>Approaching limit - consider upgrading</span>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Upgrade Suggestion */}
              {hasUpgrade && nextPlan && (
                <motion.div variants={itemVariants}>
                  <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/5 shadow-xl">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/30 to-primary/20 border-2 border-primary/40">
                          <TrendingUp className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Upgrade Available</CardTitle>
                          <CardDescription className="text-base">
                            Unlock more features and higher limits with {PLAN_NAMES[nextPlan]}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Starting at</div>
                          <div className="text-3xl font-bold">
                            €{PLAN_PRICES[nextPlan as keyof typeof PLAN_PRICES]?.monthly || 0}
                            <span className="text-lg font-normal text-muted-foreground">/month</span>
                          </div>
                        </div>
                        <Button 
                          onClick={() => navigate('/pricing')}
                          size="lg"
                          className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/40"
                        >
                          View Plans
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Features Grid */}
              <motion.div variants={itemVariants}>
                <Card className="border-2 border-primary/20 shadow-xl">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
                        <Sparkles className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Plan Features</CardTitle>
                        <CardDescription className="text-base mt-1">
                          Features and capabilities included in your current plan
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { key: 'whiteLabel', label: 'White-label', icon: '🎨', desc: 'Brand customization' },
                        { key: 'approvalWorkflows', label: 'Approval Workflows', icon: '✅', desc: 'Content review process' },
                        { key: 'bulkActions', label: 'Bulk Actions', icon: '⚡', desc: 'Batch operations' },
                        { key: 'templates', label: 'Templates Library', icon: '📚', desc: 'Pre-built templates' },
                        { key: 'automation', label: 'Automation', icon: '🤖', desc: 'Workflow automation' },
                        { key: 'multiAdmin', label: 'Multi-admin', icon: '👥', desc: 'Multiple administrators' },
                      ].map((feature, index) => {
                        const isEnabled = limits?.features[feature.key as keyof typeof limits.features] || false;
                        return (
                          <motion.div
                            key={feature.key}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.8 + index * 0.05, type: 'spring' }}
                            whileHover={{ scale: 1.03, y: -4 }}
                            className={`p-5 rounded-xl border-2 transition-all ${
                              isEnabled
                                ? 'bg-gradient-to-br from-primary/10 to-accent/5 border-primary/30 shadow-md hover:shadow-lg'
                                : 'bg-muted/30 border-muted hover:border-muted-foreground/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="text-2xl">{feature.icon}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`font-semibold ${isEnabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {feature.label}
                                  </span>
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.9 + index * 0.05, type: 'spring' }}
                                  >
                                    {isEnabled ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    )}
                                  </motion.div>
                                </div>
                                <p className="text-xs text-muted-foreground">{feature.desc}</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Billing History Tab */}
            <TabsContent value="billing" className="space-y-6 mt-6">
              <motion.div variants={itemVariants}>
                <Card className="border-2 border-primary/20 shadow-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
                          <Receipt className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Billing History</CardTitle>
                          <CardDescription className="text-base mt-1">
                            View and download your invoices
                          </CardDescription>
                        </div>
                      </div>
                      {subscription.stripe_customer_id && (
                        <Button
                          variant="outline"
                          onClick={handleManageSubscription}
                          disabled={managingSubscription}
                          className="border-2"
                        >
                          {managingSubscription ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View All Invoices
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="p-4 rounded-full bg-muted/50 mb-4">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
                      <p className="text-muted-foreground max-w-md">
                        Your billing history will appear here once you have subscription invoices. 
                        {subscription.stripe_customer_id && ' You can also view all invoices in the customer portal.'}
                      </p>
                      {subscription.stripe_customer_id && (
                        <Button
                          variant="outline"
                          onClick={handleManageSubscription}
                          className="mt-6 border-2"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Customer Portal
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Payment Methods Tab */}
            <TabsContent value="payment" className="space-y-6 mt-6">
              <motion.div variants={itemVariants}>
                <Card className="border-2 border-primary/20 shadow-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
                          <CreditCard className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl">Payment Methods</CardTitle>
                          <CardDescription className="text-base mt-1">
                            Manage your payment methods and billing information
                          </CardDescription>
                        </div>
                      </div>
                      {subscription.stripe_customer_id && (
                        <Button
                          variant="outline"
                          onClick={handleManageSubscription}
                          disabled={managingSubscription}
                          className="border-2"
                        >
                          {managingSubscription ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Manage Payment Methods
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {subscription.stripe_customer_id ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-border bg-muted/30">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-background border border-border">
                              <CreditCard className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-semibold">Payment Method</div>
                              <div className="text-sm text-muted-foreground">
                                Managed via Stripe Customer Portal
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary">Active</Badge>
                        </div>
                        <div className="bg-muted/30 border border-border rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-muted-foreground">
                              To add, update, or remove payment methods, please use the customer portal. 
                              This ensures your payment information is securely managed by Stripe.
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleManageSubscription}
                          className="w-full border-2"
                          size="lg"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Customer Portal
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-4 rounded-full bg-muted/50 mb-4">
                          <Lock className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No Payment Method</h3>
                        <p className="text-muted-foreground max-w-md">
                          Payment methods are managed through the customer portal once you have an active subscription.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
