import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AiOnboardingV2Chat } from "@/components/ai/AiOnboardingV2Chat";

export default function AiOnboardingClient() {
  const { clientId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get("returnTo");
  const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <AiOnboardingV2Chat
        onboardingType="client"
        clientId={clientId ?? null}
        onComplete={() => {
          if (safeReturnTo) {
            navigate(safeReturnTo);
            return;
          }
          if (clientId) {
            navigate(`/clients/${clientId}`);
            return;
          }
          navigate("/clients");
        }}
      />
    </div>
  );
}
