export type StrategyArtifactDecision = "approved" | "rejected" | "changes_requested";

export function mapDecisionToArtifactStatus(decision: StrategyArtifactDecision) {
  if (decision === "approved") return "approved";
  if (decision === "rejected") return "rejected";
  return "review";
}

export function formatDecisionLabel(decision: string | null | undefined) {
  switch (decision) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "changes_requested":
      return "Changes requested";
    default:
      return "Pending review";
  }
}
