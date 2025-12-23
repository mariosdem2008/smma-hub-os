import { AiOnboardingChat } from "@/components/ai/AiOnboardingChat";

export default function AiOnboardingClient() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <AiOnboardingChat onboardingType="client" />
    </div>
  );
}
