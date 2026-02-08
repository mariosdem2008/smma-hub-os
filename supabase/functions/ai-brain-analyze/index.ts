import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

/**
 * AI Brain Analyze Edge Function
 *
 * Analyzes uploaded documents and transforms them into structured brain module content.
 *
 * Request:
 * {
 *   agency_id: string
 *   layer: BrainModule
 *   mode: "transform" | "original"
 *   file_path: string | null
 *   file_name: string
 *   file_type: string
 *   raw_input_text?: string  // For configure modal generation
 * }
 *
 * Response:
 * {
 *   extracted_text: string
 *   transformed_output: Record<string, unknown> | null
 *   format: "json" | "markdown" | "text"
 *   warnings: string[]
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  agency_id: string;
  layer: string;
  mode: "transform" | "original";
  file_path: string | null;
  file_name: string;
  file_type: string;
  raw_input_text?: string;
}

interface AnalyzeResponse {
  extracted_text: string;
  transformed_output: Record<string, unknown> | null;
  format: "json" | "markdown" | "text";
  warnings: string[];
}

serve(async (req) => {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const spanStart = Date.now();
  let response: Response | undefined;
  let supabase: ReturnType<typeof createClient> | null = null;
  let agencyId: string | undefined;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  response = await (async () => {
    try {
      const guardResponse = getEndpointGuardResponse("ai-brain-analyze", corsHeaders);
      if (guardResponse) return guardResponse;

      // Verify authorization
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Parse request
      const body: AnalyzeRequest = await req.json();
      const { agency_id, layer, mode, file_path, file_name, file_type, raw_input_text } = body;
      agencyId = agency_id;

    // Validate required fields
    if (!agency_id || !layer) {
      return new Response(JSON.stringify({ error: "Missing required fields: agency_id, layer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extractedText = "";
    const warnings: string[] = [];

    // Extract text from file or use raw input
    if (raw_input_text) {
      extractedText = raw_input_text;
    } else if (file_path) {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("brain-documents")
        .download(file_path);

      if (downloadError) {
        warnings.push(`Could not download file: ${downloadError.message}`);
      } else if (fileData) {
        // Extract text based on file type
        if (file_type === "text/plain" || file_type === "text/markdown" ||
            file_name.endsWith(".md") || file_name.endsWith(".txt")) {
          extractedText = await fileData.text();
        } else if (file_type === "application/pdf") {
          // TODO: Integrate PDF parsing library
          warnings.push("PDF parsing not yet implemented. Using placeholder.");
          extractedText = `[PDF content from ${file_name}]`;
        } else if (file_type.includes("wordprocessingml") || file_name.endsWith(".docx")) {
          // TODO: Integrate DOCX parsing library
          warnings.push("DOCX parsing not yet implemented. Using placeholder.");
          extractedText = `[DOCX content from ${file_name}]`;
        } else {
          warnings.push(`Unsupported file type: ${file_type}`);
          extractedText = `[Content from ${file_name}]`;
        }
      }
    }

    // Determine response based on mode
    let transformedOutput: Record<string, unknown> | null = null;
    let format: "json" | "markdown" | "text" = "text";

    if (mode === "transform" && extractedText) {
      // TODO: Call AI to transform content to structured format
      // For now, return the raw content wrapped in a structure
      transformedOutput = await transformToStructure(layer, extractedText);
      format = "json";
    } else {
      // Keep original format
      transformedOutput = { raw_content: extractedText };
      format = extractedText.startsWith("#") ? "markdown" : "text";
    }

    const response: AnalyzeResponse = {
      extracted_text: extractedText,
      transformed_output: transformedOutput,
      format,
      warnings,
    };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error in ai-brain-analyze:", error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-brain-analyze",
    taskType: TaskType.TOOL_EXECUTION,
    agencyId,
    latencyMs: Date.now() - spanStart,
    attributes: { http_status: response?.status ?? 0 },
  });

  return response!;
});

/**
 * Transform raw text to structured brain module content
 * TODO: Integrate with AI router for actual transformation
 */
async function transformToStructure(
  layer: string,
  text: string
): Promise<Record<string, unknown>> {
  // For now, return a basic structure with the raw content
  // In production, this would call the AI to parse and structure the content

  const baseStructure: Record<string, Record<string, unknown>> = {
    bootstrap: {
      identity: { name: "", niches: [], offers: [], geo: [], languages: [] },
      icp: { industries: [], size: [], personas: [], pains: [], objections: [] },
      _raw: text,
    },
    rep_policy: {
      ai_name: "",
      persona_description: "",
      boundaries: { can_do: [], cannot_do: [], escalation_rule: "" },
      never_say: [],
      never_do: [],
      _raw: text,
    },
    sop_strategy: {
      pillars: [],
      strategy_process: [],
      platform_priorities: [],
      content_frequency: {},
      planning_cadence: "",
      _raw: text,
    },
    sop_scripting: {
      hook_templates: [],
      cta_templates: [],
      format_guidelines: {},
      length_guidelines: {},
      quality_checklist: [],
      _raw: text,
    },
    tone_voice: {
      adjectives: [],
      banned_words: [],
      preferred_vocab: [],
      writing_rules: [],
      examples: [],
      _raw: text,
    },
    faq_objections: {
      faqs: [],
      objections: [],
      _raw: text,
    },
    ai_permissions: {
      read_scopes: { client_summary: true, pipeline: true, calendar: true, analytics: false },
      write_scopes: { create_drafts: true, propose_brain_updates: true },
      safety_scopes: { require_external_confirmation: true, no_guarantee_promises: true },
      _raw: text,
    },
    offer_stack: {
      tiers: [],
      usps: [],
      positioning: "",
      target_outcome: "",
      _raw: text,
    },
    quality_bar: {
      review_criteria: [],
      acceptance_threshold: "",
      revision_limits: 3,
      escalation_triggers: [],
      _raw: text,
    },
  };

  return baseStructure[layer] ?? { raw_content: text };
}
