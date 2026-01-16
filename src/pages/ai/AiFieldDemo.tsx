// ============================================================================
// QUARANTINED
// This page was a local demo route and is no longer reachable from the router.
// Keep for reference only; do not ship/enable without explicit product need.
// ============================================================================

import { AIField } from "@/components/ai/AIField";

export default function AiFieldDemo() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <AIField
        title="Agency Voice/Tone"
        initialState="suggested"
        initialValue="Warm, confident, and direct. Avoid hype, prefer clear CTAs."
        citations={["agency_brain.voice_tone.adjectives", "doc:ai_artifact#chunk_12"]}
      />
      <AIField
        title="Client Strategy Summary"
        initialState="edited_by_human"
        initialValue="Focus on educational reels and weekly founder stories."
        citations={["client_brain.pillars", "doc:client_guidelines#chunk_3"]}
      />
      <AIField title="Safety Policy" initialState="empty" />
    </div>
  );
}
