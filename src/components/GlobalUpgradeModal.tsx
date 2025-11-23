import { UpgradeModal } from './UpgradeModal';
import { useUpgradeModal } from '@/contexts/UpgradeModalContext';

export function GlobalUpgradeModal() {
  const { isOpen, closeUpgradeModal, suggestedPlan, feature } = useUpgradeModal();

  return (
    <UpgradeModal
      open={isOpen}
      onOpenChange={closeUpgradeModal}
      suggestedPlan={suggestedPlan}
      feature={feature}
    />
  );
}
