import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import { useUpgradeModal } from '@/contexts/UpgradeModalContext';
import { useState } from 'react';
import { ContactOwnerModal } from '@/components/billing/ContactOwnerModal';

interface UsageWarningProps {
  type: 'storage' | 'clients' | 'team' | 'analytics';
  current: number;
  limit: number;
  feature?: string;
}

export function UsageWarning({ type, current, limit, feature }: UsageWarningProps) {
  const { role, isOwner } = useRole();
  const { openUpgradeModal } = useUpgradeModal();
  const [showContactModal, setShowContactModal] = useState(false);
  const percentage = (current / limit) * 100;

  if (percentage < 80) return null;

  const messages = {
    storage: 'Your storage is nearly full',
    clients: 'You\'re approaching your client limit',
    team: 'You\'re approaching your team member limit',
    analytics: 'Upgrade to access full analytics history',
  };

  const handleUpgradeClick = () => {
    if (isOwner) {
      openUpgradeModal();
    } else {
      setShowContactModal(true);
    }
  };

  const getButtonText = () => {
    if (isOwner) return 'Upgrade Now';
    if (role === 'admin') return 'Request Upgrade';
    return 'Contact Owner';
  };

  return (
    <>
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="flex items-center justify-between">
          <span>{messages[type]}: {current} / {limit}</span>
          <Button size="sm" variant="outline" onClick={handleUpgradeClick}>
            {getButtonText()}
          </Button>
        </AlertDescription>
      </Alert>

      <ContactOwnerModal
        open={showContactModal}
        onOpenChange={setShowContactModal}
        feature={feature || messages[type]}
      />
    </>
  );
}
