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
import { Loader2, Upload, Eye, Palette, Mail, Globe, Crown, FileImage, Type, Layout, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useUpgradeModal } from '@/contexts/UpgradeModalContext';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PortalPreview } from './PortalPreview';
import { WhiteLabelAdvanced } from './WhiteLabelAdvanced';
import { Separator } from '@/components/ui/separator';

const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Raleway', 'Poppins',
  'Playfair Display', 'Merriweather', 'PT Sans', 'Ubuntu', 'Nunito'
];

const LAYOUT_STYLES = [
  { value: 'default', label: 'Default', description: 'Balanced spacing and modern design' },
  { value: 'modern', label: 'Modern', description: 'Clean lines with generous spacing' },
  { value: 'minimal', label: 'Minimal', description: 'Compact and efficient layout' },
  { value: 'bold', label: 'Bold', description: 'Large typography and prominent elements' },
];

export function WhiteLabelSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [accentColor, setAccentColor] = useState('#8b5cf6');
  const [fontPrimary, setFontPrimary] = useState('Inter');
  const [fontSecondary, setFontSecondary] = useState('Inter');
  const [layoutStyle, setLayoutStyle] = useState('default');
  const [customDomain, setCustomDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState<'pending' | 'verified' | 'failed'>('pending');
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailFooter, setEmailFooter] = useState('');
  const [sectionLabels, setSectionLabels] = useState({});

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
        setLogoUrl(branding.logo_url || '');
        setFaviconUrl(branding.favicon_url || '');
        setPrimaryColor(branding.primary_color || '#6366f1');
        setAccentColor(branding.accent_color || '#8b5cf6');
        setFontPrimary(branding.font_primary || 'Inter');
        setFontSecondary(branding.font_secondary || 'Inter');
        setLayoutStyle(branding.layout_style || 'default');
        setCustomDomain(branding.custom_domain || '');
        setDomainStatus(branding.domain_status as any || 'pending');
        setEmailSenderName(branding.email_sender_name || '');
        setEmailFooter(branding.email_footer || '');
        setSectionLabels(branding.section_labels || {});
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

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'favicon'
  ) => {
    if (!e.target.files || !e.target.files[0] || !agencyId) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${agencyId}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('branding-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('branding-assets')
        .getPublicUrl(fileName);

      if (type === 'logo') {
        setLogoUrl(publicUrl);
      } else {
        setFaviconUrl(publicUrl);
      }
      
      toast({
        title: 'Success',
        description: `${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully`,
      });
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast({
        title: 'Error',
        description: `Failed to upload ${type}`,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!agencyId || !customDomain) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-custom-domain', {
        body: { domain: customDomain, agency_id: agencyId }
      });

      if (error) throw error;

      setDomainStatus(data.verified ? 'verified' : 'failed');
      toast({
        title: data.verified ? 'Success' : 'Verification Failed',
        description: data.message,
        variant: data.verified ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify domain',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
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
          favicon_url: faviconUrl || null,
          primary_color: primaryColor,
          accent_color: accentColor,
          font_primary: fontPrimary,
          font_secondary: fontSecondary,
          layout_style: layoutStyle,
          custom_domain: customDomain || null,
          domain_status: domainStatus,
          email_sender_name: emailSenderName || null,
          email_footer: emailFooter || null,
          section_labels: sectionLabels,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'White label settings saved successfully',
      });

      // Reload to apply changes
      window.location.reload();
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
            Transform the client portal into your own branded SaaS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertDescription>
              White label branding is available on Pro and Agency Plus plans. Unlock complete control over logos, colors, fonts, layouts, custom domains, and email branding.
            </AlertDescription>
          </Alert>

          <Button onClick={() => openUpgradeModal({ feature: 'White Label Branding' })} className="w-full">
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
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>White Label & Branding</CardTitle>
            <Badge variant="secondary">Active</Badge>
          </div>
          <CardDescription>
            Completely rebrand the client portal with your agency's identity
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="layout">Layout & Fonts</TabsTrigger>
          <TabsTrigger value="domain">Custom Domain</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Logo Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileImage className="h-4 w-4" />
                    Agency Logo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Agency Logo" className="w-32 h-32 object-contain border rounded-lg" />
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'logo')}
                        disabled={uploading}
                      />
                      {uploading && <p className="text-sm text-muted-foreground mt-1">Uploading...</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Favicon Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileImage className="h-4 w-4" />
                    Favicon
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {faviconUrl ? (
                      <img src={faviconUrl} alt="Favicon" className="w-16 h-16 object-contain border rounded-lg" />
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/x-icon,image/png"
                        onChange={(e) => handleFileUpload(e, 'favicon')}
                        disabled={uploading}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Colors */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Brand Colors
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Primary Color</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-20 h-10"
                        />
                        <Input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Accent Color</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-20 h-10"
                        />
                        <Input
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Identity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Identity
                  </CardTitle>
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
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Preview */}
            <div className="lg:sticky lg:top-6">
              <PortalPreview
                logoUrl={logoUrl}
                primaryColor={primaryColor}
                accentColor={accentColor}
                layoutStyle={layoutStyle}
                fontPrimary={fontPrimary}
                fontSecondary={fontSecondary}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="layout" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Typography */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Typography
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Primary Font (Headings)</Label>
                    <Select value={fontPrimary} onValueChange={setFontPrimary}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOOGLE_FONTS.map((font) => (
                          <SelectItem key={font} value={font}>
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Secondary Font (Body)</Label>
                    <Select value={fontSecondary} onValueChange={setFontSecondary}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOOGLE_FONTS.map((font) => (
                          <SelectItem key={font} value={font}>
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Layout Presets */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layout className="h-4 w-4" />
                    Layout Style
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {LAYOUT_STYLES.map((style) => (
                    <div
                      key={style.value}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        layoutStyle === style.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setLayoutStyle(style.value)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{style.label}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {style.description}
                          </p>
                        </div>
                        {layoutStyle === style.value && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="lg:sticky lg:top-6">
              <PortalPreview
                logoUrl={logoUrl}
                primaryColor={primaryColor}
                accentColor={accentColor}
                layoutStyle={layoutStyle}
                fontPrimary={fontPrimary}
                fontSecondary={fontSecondary}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="domain" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Custom Domain
                {!canUseCustomDomain && <Badge variant="secondary">Agency Plus Only</Badge>}
              </CardTitle>
              <CardDescription>
                Use your own domain for the client portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUseCustomDomain ? (
                <>
                  <div>
                    <Label>Portal Domain</Label>
                    <Input
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="portal.youragency.com"
                      className="mt-2"
                    />
                  </div>

                  {customDomain && (
                    <Alert>
                      <AlertDescription className="space-y-2">
                        <p className="font-semibold">DNS Configuration:</p>
                        <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
                          <div>Type: <strong>CNAME</strong></div>
                          <div>Host: <strong>portal</strong></div>
                          <div>Value: <strong>dzyhrzdwwuaorruscxcn.supabase.co</strong></div>
                          <div>TTL: <strong>300</strong></div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleVerifyDomain}
                      disabled={!customDomain || verifying}
                    >
                      {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify DNS
                    </Button>
                    {domainStatus === 'verified' && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    {domainStatus === 'failed' && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Failed
                      </Badge>
                    )}
                    {domainStatus === 'pending' && customDomain && (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </>
              ) : (
                <Alert>
                  <Crown className="h-4 w-4" />
                  <AlertDescription>
                    Custom domain is available on Agency Plus plan. Upgrade to use your own domain for the client portal.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <WhiteLabelAdvanced
            sectionLabels={sectionLabels}
            onSave={setSectionLabels}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save All Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
