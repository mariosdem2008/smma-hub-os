/**
 * Example content templates for each brain layer.
 * These serve as reference structures that users can follow
 * when uploading or generating content for each module.
 *
 * Content is loaded from markdown files for better maintainability.
 */

import type { BrainModule } from "@/lib/ai/brainModules";

// Import markdown files as raw strings using Vite's ?raw suffix
import bootstrapExample from "./examples/bootstrap.md?raw";
import repPolicyExample from "./examples/rep_policy.md?raw";
import strategySopExample from "./examples/strategy_sop.md?raw";
import scriptingSopExample from "./examples/scripting_sop.md?raw";
import toneVoiceExample from "./examples/tone_voice.md?raw";
import faqObjectionsExample from "./examples/faq_objections.md?raw";
import aiPermissionsExample from "./examples/ai_permissions.md?raw";
import offerStackExample from "./examples/offer_stack.md?raw";
import qualityBarExample from "./examples/quality_bar.md?raw";

const EXAMPLE_CONTENT: Record<BrainModule, string> = {
  bootstrap: bootstrapExample,
  rep_policy: repPolicyExample,
  sop_strategy: strategySopExample,
  sop_scripting: scriptingSopExample,
  tone_voice: toneVoiceExample,
  faq_objections: faqObjectionsExample,
  ai_permissions: aiPermissionsExample,
  offer_stack: offerStackExample,
  quality_bar: qualityBarExample,
};

/**
 * Get the example content for a brain module
 */
export function getExampleContent(module: BrainModule): string {
  return EXAMPLE_CONTENT[module];
}

/**
 * Get a preview (first N lines) of example content
 */
export function getExamplePreview(module: BrainModule, lines = 10): string {
  const content = EXAMPLE_CONTENT[module];
  return content.split("\n").slice(0, lines).join("\n");
}
