import { createContext, useContext, useState, ReactNode } from 'react';
import type { PlanType } from '@/lib/plan-limits';

interface UpgradeModalContextType {
  isOpen: boolean;
  openUpgradeModal: (options?: { suggestedPlan?: PlanType; feature?: string }) => void;
  closeUpgradeModal: () => void;
  suggestedPlan?: PlanType;
  feature?: string;
}

const UpgradeModalContext = createContext<UpgradeModalContextType | undefined>(undefined);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestedPlan, setSuggestedPlan] = useState<PlanType | undefined>();
  const [feature, setFeature] = useState<string | undefined>();

  const openUpgradeModal = (options?: { suggestedPlan?: PlanType; feature?: string }) => {
    setSuggestedPlan(options?.suggestedPlan);
    setFeature(options?.feature);
    setIsOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsOpen(false);
    setSuggestedPlan(undefined);
    setFeature(undefined);
  };

  return (
    <UpgradeModalContext.Provider
      value={{ isOpen, openUpgradeModal, closeUpgradeModal, suggestedPlan, feature }}
    >
      {children}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal() {
  const context = useContext(UpgradeModalContext);
  if (!context) {
    throw new Error('useUpgradeModal must be used within UpgradeModalProvider');
  }
  return context;
}
