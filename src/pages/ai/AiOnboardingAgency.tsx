import { AiOnboardingChat } from "@/components/ai/AiOnboardingChat";

export default function AiOnboardingAgency() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <AiOnboardingChat onboardingType="agency" />
    </div>
  );
}
