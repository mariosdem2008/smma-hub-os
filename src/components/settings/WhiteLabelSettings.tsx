import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2, Mail, Globe, Crown } from 'lucide-react';
import { useUpgradeModal } from '@/contexts/UpgradeModalContext';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DomainSetup } from './DomainSetup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function WhiteLabelSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  const [customDomain, setCustomDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState<'pending' | 'verified' | 'failed'>('pending');
  const [verificationStatus, setVerificationStatus] = useState('not_configured');
  const [sslStatus, setSslStatus] = useState('pending');
  const [dnsRequiredRecord, setDnsRequiredRecord] = useState<string | null>(null);
  const [dnsLastChecked, setDnsLastChecked] = useState<string | null>(null);
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailFooter, setEmailFooter] = useState('');

  const canAccessWhiteLabel = subscription?.plan_type === 'pro' || subscription?.plan_type === 'agency_plus';
  const canUseCustomDomain = subscription?.plan_type === 'agency_plus';

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) return;
      setAgencyId(agency.id);

      const { data: branding } = await supabase
        .from('agency_branding')
        .select('*')
        .eq('agency_id', agency.id)
        .maybeSingle();

      if (branding) {
        setCustomDomain(branding.custom_domain || '');
        setDomainStatus(branding.domain_status as any || 'pending');
        setVerificationStatus(branding.verification_status || 'not_configured');
        setSslStatus(branding.ssl_status || 'pending');
        setDnsRequiredRecord(branding.dns_required_record);
        setDnsLastChecked(branding.dns_last_checked);
        setEmailSenderName(branding.email_sender_name || '');
        setEmailFooter(branding.email_footer || '');
      }
    } catch (error) {
      console.error('Error fetching white label settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load white label settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!agencyId || !customDomain) return;

    try {
      const { data, error } = await supabase.functions.invoke('verify-custom-domain', {
        body: { domain: customDomain, agency_id: agencyId }
      });

      if (error) throw error;

      toast({
        title: data.verified ? 'Success' : 'Verification Failed',
        description: data.message,
        variant: data.verified ? 'default' : 'destructive',
      });
      
      fetchSettings();
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify domain',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!agencyId) return;

    if (!canAccessWhiteLabel) {
      openUpgradeModal({ feature: 'White Label Branding' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agency_branding')
        .upsert({
          agency_id: agencyId,
          custom_domain: customDomain || null,
          domain_status: domainStatus,
          email_sender_name: emailSenderName || null,
          email_footer: emailFooter || null,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'White label settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving white label settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save white label settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canAccessWhiteLabel) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle>White Label Settings</CardTitle>
            <Badge variant="secondary">Pro & Agency Plus</Badge>
          </div>
          <CardDescription>
            Customize email identity and use custom domains for your client portals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertDescription>
              White label settings are available on Pro and Agency Plus plans. Unlock custom email branding and custom domains for your client portals.
            </AlertDescription>
          </Alert>

          <Button onClick={() => openUpgradeModal({ feature: 'White Label Settings' })} className="w-full">
            Upgrade to Unlock White Label
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>White Label Settings</CardTitle>
            <Badge variant="secondary">Active</Badge>
          </div>
          <CardDescription>
            Configure email identity and custom domain for your client portals
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">Email Identity</TabsTrigger>
          <TabsTrigger value="domain">
            <Globe className="h-4 w-4 mr-2" />
            Custom Domain
            {!canUseCustomDomain && <Crown className="h-3 w-3 ml-2" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-6">
          {/* Email Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Identity
              </CardTitle>
              <CardDescription>
                Customize the sender name and footer for all client-facing emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email Sender Name</Label>
                <Input
                  value={emailSenderName}
                  onChange={(e) => setEmailSenderName(e.target.value)}
                  placeholder="Your Agency Name"
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This name will appear in the "From" field of all client emails
                </p>
              </div>
              <div>
                <Label>Email Footer</Label>
                <Textarea
                  value={emailFooter}
                  onChange={(e) => setEmailFooter(e.target.value)}
                  placeholder="Custom footer text for outgoing emails..."
                  className="mt-2"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Add custom text to the bottom of all client-facing emails
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="domain" className="space-y-6">
          {/* Custom Domain */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Custom Domain Setup
                {!canUseCustomDomain && <Badge variant="secondary">Agency Plus</Badge>}
              </CardTitle>
              <CardDescription>
                Use your own domain for client portals (e.g., portal.youragency.com)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!canUseCustomDomain ? (
                <Alert>
                  <Crown className="h-4 w-4" />
                  <AlertDescription>
                    Custom domains are available on the Agency Plus plan.
                    <Button
                      variant="link"
                      className="px-0 ml-1"
                      onClick={() => openUpgradeModal({ feature: 'Custom Domain' })}
                    >
                      Upgrade now
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <DomainSetup
                  agencyId={agencyId!}
                  currentDomain={customDomain}
                  verificationStatus={verificationStatus}
                  sslStatus={sslStatus}
                  dnsRequiredRecord={dnsRequiredRecord}
                  dnsLastChecked={dnsLastChecked}
                  onUpdate={fetchSettings}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
