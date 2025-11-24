import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DomainSetupProps {
  agencyId: string;
  currentDomain: string;
  verificationStatus: string;
  sslStatus: string;
  dnsRequiredRecord: string | null;
  dnsLastChecked: string | null;
  onUpdate: () => void;
}

export function DomainSetup({
  agencyId,
  currentDomain,
  verificationStatus,
  sslStatus,
  dnsRequiredRecord,
  dnsLastChecked,
  onUpdate,
}: DomainSetupProps) {
  const { toast } = useToast();
  const [domain, setDomain] = useState(currentDomain);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const getStatusBadge = () => {
    switch (verificationStatus) {
      case 'verified':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Not Configured
          </Badge>
        );
    }
  };

  const getSSLBadge = () => {
    if (verificationStatus !== 'verified') return null;
    
    switch (sslStatus) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            SSL Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            SSL Provisioning
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            SSL Failed
          </Badge>
        );
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  const validateDomain = (domain: string): boolean => {
    // Must be a subdomain (contains at least one dot and doesn't start/end with dot)
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
    return domainRegex.test(domain);
  };

  const handleSaveDomain = async () => {
    if (!validateDomain(domain)) {
      toast({
        title: 'Invalid Domain',
        description: 'Please enter a valid subdomain (e.g., portal.youragency.com)',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('agency_branding')
        .upsert({
          agency_id: agencyId,
          custom_domain: domain,
          verification_status: 'pending',
          dns_required_record: window.location.hostname,
        });

      if (error) throw error;

      toast({
        title: 'Domain Saved',
        description: 'Your domain has been configured. Please add the DNS records and verify.',
      });

      onUpdate();
    } catch (error) {
      console.error('Error saving domain:', error);
      toast({
        title: 'Error',
        description: 'Failed to save domain',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!domain) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-custom-domain', {
        body: { domain, agency_id: agencyId },
      });

      if (error) throw error;

      toast({
        title: data.verified ? 'Success' : 'Verification Failed',
        description: data.message,
        variant: data.verified ? 'default' : 'destructive',
      });

      onUpdate();
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

  const targetDomain = dnsRequiredRecord || window.location.hostname;

  return (
    <div className="space-y-6">
      {/* Domain Input */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="domain">Custom Portal Domain</Label>
          <div className="flex gap-2 mt-2">
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              placeholder="portal.youragency.com"
              className="flex-1"
            />
            <Button onClick={handleSaveDomain} disabled={saving || !domain}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Domain'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enter your custom subdomain (e.g., portal.youragency.com)
          </p>
        </div>

        {currentDomain && (
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {getSSLBadge()}
          </div>
        )}
      </div>

      {/* DNS Instructions */}
      {currentDomain && verificationStatus !== 'verified' && (
        <Alert>
          <Globe className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-3">Add this DNS record to your domain registrar:</p>
            <div className="space-y-2 font-mono text-xs bg-muted p-3 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-semibold">CNAME</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard('CNAME')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Host:</span>{' '}
                  <span className="font-semibold">{currentDomain.split('.')[0]}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(currentDomain.split('.')[0])}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1 overflow-hidden">
                  <span className="text-muted-foreground">Value:</span>{' '}
                  <span className="font-semibold break-all">{targetDomain}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(targetDomain)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">TTL:</span>{' '}
                  <span className="font-semibold">300</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard('300')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs">
              <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">DNS changes can take up to 72 hours to propagate.</p>
                <p className="text-muted-foreground mt-1">
                  After adding the DNS record, click "Check DNS Status" to verify.
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Verification Button */}
      {currentDomain && (
        <div className="flex items-center gap-4">
          <Button onClick={handleVerifyDomain} disabled={verifying} variant="outline">
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking DNS...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check DNS Status
              </>
            )}
          </Button>

          {dnsLastChecked && (
            <span className="text-xs text-muted-foreground">
              Last checked: {new Date(dnsLastChecked).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Success State */}
      {verificationStatus === 'verified' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-900">
            <p className="font-semibold mb-2">Domain Verified Successfully!</p>
            <p className="text-sm">
              Your custom domain is now active. Clients can access the portal at:
            </p>
            <a
              href={`https://${currentDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-mono mt-2 text-blue-600 hover:underline"
            >
              https://{currentDomain}
              <ExternalLink className="h-3 w-3" />
            </a>
            {sslStatus === 'pending' && (
              <p className="text-sm mt-2 text-yellow-700">
                SSL certificate is being provisioned. This may take a few minutes.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Help Text */}
      <Alert>
        <AlertDescription className="text-xs">
          <p className="font-medium mb-2">Need help?</p>
          <ul className="space-y-1 list-disc list-inside text-muted-foreground">
            <li>Make sure you add the DNS record to your domain registrar (GoDaddy, Namecheap, etc.)</li>
            <li>Use the exact values shown above</li>
            <li>Wait 5-10 minutes after adding the record before checking</li>
            <li>Some DNS providers may take up to 72 hours to update</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
