import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2, Upload, Eye, Palette, Mail, Globe, Crown } from 'lucide-react';
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
  const [uploading, setUploading] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [accentColor, setAccentColor] = useState('#8b5cf6');
  const [customDomain, setCustomDomain] = useState('');
  const [emailSenderName, setEmailSenderName] = useState('');

  const canAccessWhiteLabel = subscription?.plan_type === 'pro' || subscription?.plan_type === 'agency_plus';

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get agency ID
      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) return;
      setAgencyId(agency.id);

      // Get branding settings
      const { data: branding } = await supabase
        .from('agency_branding')
        .select('*')
        .eq('agency_id', agency.id)
        .maybeSingle();

      if (branding) {
        setLogoUrl(branding.logo_url || '');
        setPrimaryColor(branding.primary_color || '#6366f1');
        setAccentColor(branding.accent_color || '#8b5cf6');
        setCustomDomain(branding.custom_domain || '');
        setEmailSenderName(branding.email_sender_name || '');
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !agencyId) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${agencyId}-logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-logos')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      
      toast({
        title: 'Success',
        description: 'Logo uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
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
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          accent_color: accentColor,
          custom_domain: customDomain || null,
          email_sender_name: emailSenderName || null,
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
            <CardTitle>White Label Branding</CardTitle>
            <Badge variant="secondary">Pro & Agency Plus</Badge>
          </div>
          <CardDescription>
            Customize your client portal with your own branding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertDescription>
              White label branding is available on Pro and Agency Plus plans. Upgrade to customize your client portal with your own logo, colors, and domain.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4 opacity-50 pointer-events-none">
            <div>
              <Label>Agency Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Primary Color</Label>
                <Input type="color" disabled value="#6366f1" />
              </div>
              <div>
                <Label>Accent Color</Label>
                <Input type="color" disabled value="#8b5cf6" />
              </div>
            </div>

            <div>
              <Label>Email Sender Name</Label>
              <Input placeholder="Your Agency Name" disabled />
            </div>

            <div>
              <Label>Custom Domain</Label>
              <Input placeholder="portal.youragency.com" disabled />
            </div>
          </div>

          <Button onClick={() => openUpgradeModal({ feature: 'White Label Branding' })} className="w-full">
            Upgrade to Unlock White Label
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle>White Label Branding</CardTitle>
          <Badge variant="secondary">Active</Badge>
        </div>
        <CardDescription>
          Customize your client portal with your own branding
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload */}
        <div>
          <Label htmlFor="logo">Agency Logo</Label>
          <div className="mt-2 flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Agency Logo" className="w-32 h-32 object-contain border rounded-lg" />
            ) : (
              <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="max-w-xs"
              />
              {uploading && <p className="text-sm text-muted-foreground mt-1">Uploading...</p>}
            </div>
          </div>
        </div>

        {/* Color Pickers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primary-color">Primary Color</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="primary-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#6366f1"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="accent-color">Accent Color</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="accent-color"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#8b5cf6"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Email Sender Name */}
        <div>
          <Label htmlFor="email-sender">
            <Mail className="h-4 w-4 inline mr-2" />
            Email Sender Name
          </Label>
          <Input
            id="email-sender"
            type="text"
            value={emailSenderName}
            onChange={(e) => setEmailSenderName(e.target.value)}
            placeholder="Your Agency Name"
            className="mt-2"
          />
          <p className="text-sm text-muted-foreground mt-1">
            This name will appear in all emails sent from your client portal
          </p>
        </div>

        {/* Custom Domain */}
        <div>
          <Label htmlFor="custom-domain">
            <Globe className="h-4 w-4 inline mr-2" />
            Custom Domain
          </Label>
          <Input
            id="custom-domain"
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="portal.youragency.com"
            className="mt-2"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Contact support to set up DNS records for your custom domain
          </p>
        </div>

        {/* Preview & Save */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <Button variant="outline" disabled>
            <Eye className="mr-2 h-4 w-4" />
            Preview Portal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
