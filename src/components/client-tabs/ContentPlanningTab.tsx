import IdeasTab from "./IdeasTab";

interface ContentPlanningTabProps {
  clientId: string;
}

export default function ContentPlanningTab({ clientId }: ContentPlanningTabProps) {
  return (
    <div className="w-full">
      <IdeasTab clientId={clientId} />
    </div>
  );
}
