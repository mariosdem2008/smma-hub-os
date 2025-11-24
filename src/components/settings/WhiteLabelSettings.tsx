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
import { Loader2, Mail, Crown } from 'lucide-react';
import { useUpgradeModal } from '@/contexts/UpgradeModalContext';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function WhiteLabelSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailFooter, setEmailFooter] = useState('');

  const canAccessWhiteLabel = subscription?.plan_type === 'pro' || subscription?.plan_type === 'agency_plus';

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
          email_sender_name: emailSenderName || null,
          email_footer: emailFooter || null,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Email identity settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving white label settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save email identity settings',
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
            <CardTitle>Email Identity Settings</CardTitle>
            <Badge variant="secondary">Pro & Agency Plus</Badge>
          </div>
          <CardDescription>
            Customize email identity for your client communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertDescription>
              Email identity settings are available on Pro and Agency Plus plans. Unlock custom email branding for your client communications.
            </AlertDescription>
          </Alert>

          <Button onClick={() => openUpgradeModal({ feature: 'Email Identity' })} className="w-full">
            Upgrade to Unlock Email Identity
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
            <CardTitle>Email Identity Settings</CardTitle>
            <Badge variant="secondary">Active</Badge>
          </div>
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

          <div className="flex justify-end pt-4">
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
        </CardContent>
      </Card>
    </div>
  );
}