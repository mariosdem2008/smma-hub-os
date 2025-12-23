import { AiOnboardingV2Chat } from "@/components/ai/AiOnboardingV2Chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiOnboardingV2Agency() {
  const enabled = import.meta.env.VITE_AI_ONBOARDING_V2_ENABLED === "true";

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>AI Onboarding v2 is disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Enable VITE_AI_ONBOARDING_V2_ENABLED to access the v2 flow.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <AiOnboardingV2Chat onboardingType="agency" />
    </div>
  );
}
