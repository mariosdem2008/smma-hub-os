import { createContext, useContext, useState, ReactNode } from 'react';
import { useRole } from '@/hooks/useRole';
import type { PlanType } from '@/lib/plan-limits';

export type AssistantReason = 
  | 'storage_near_limit'
  | 'client_limit_reached'
  | 'team_limit_reached'
  | 'analytics_interest'
  | 'ai_usage_high'
  | 'onboarding_growth_detected'
  | 'white_label_interest'
  | 'workflows_interest'
  | 'bulk_actions_interest'
  | 'time_trigger_72h'
  | 'session_trigger';

interface UpgradeAssistantContextType {
  isCardOpen: boolean;
  isBubbleVisible: boolean;
  isPulsing: boolean;
  currentReason: AssistantReason | null;
  triggerAssistant: (reason: AssistantReason) => void;
  openAssistantCard: () => void;
  closeAssistantCard: () => void;
  hideBubble: () => void;
}

const UpgradeAssistantContext = createContext<UpgradeAssistantContextType | undefined>(undefined);

export function UpgradeAssistantProvider({ children }: { children: ReactNode }) {
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);
  const [isPulsing, setIsPulsing] = useState(false);
  const [currentReason, setCurrentReason] = useState<AssistantReason | null>(null);
  const { role, loading: roleLoading } = useRole();

  const triggerAssistant = (reason: AssistantReason) => {
    // Don't show assistant if role is not loaded yet
    if (roleLoading) return;
    
    setCurrentReason(reason);
    setIsPulsing(true);
    setIsBubbleVisible(true);
    
    // Track analytics with role context
    console.log('[Upgrade Assistant] Triggered:', reason, 'Role:', role);
    
    // Stop pulsing after 5 seconds
    setTimeout(() => setIsPulsing(false), 5000);
  };

  const openAssistantCard = () => {
    setIsCardOpen(true);
    setIsPulsing(false);
    console.log('[Upgrade Assistant] Card opened');
  };

  const closeAssistantCard = () => {
    setIsCardOpen(false);
  };

  const hideBubble = () => {
    setIsBubbleVisible(false);
  };

  return (
    <UpgradeAssistantContext.Provider
      value={{
        isCardOpen,
        isBubbleVisible,
        isPulsing,
        currentReason,
        triggerAssistant,
        openAssistantCard,
        closeAssistantCard,
        hideBubble,
      }}
    >
      {children}
    </UpgradeAssistantContext.Provider>
  );
}

export function useUpgradeAssistant() {
  const context = useContext(UpgradeAssistantContext);
  if (!context) {
    throw new Error('useUpgradeAssistant must be used within UpgradeAssistantProvider');
  }
  return context;
}
