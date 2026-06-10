import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { logUsage } from "../../../src/ai/logging.ts";
import { calculateCost, incrementBudget } from "../_shared/budgets.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { enforceAgencyAgentActivation } from "../_shared/agency-ai-setup.ts";
import { buildCreatorBriefArtifact, evaluateCreatorBriefArtifact, renderCreatorBriefPromptContext } from "../../../src/lib/strategy/v2/creatorBrief.ts";
import { createAgentRunV2, createArtifactEvaluationV2, createStrategyArtifactV2, finalizeAgentRunV2 } from "../_shared/strategy-v2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Plan quotas for AI generation
const PLAN_QUOTAS: Record<string, number> = {
  free: 20,
  starter: 200,
  pro: 500,
  agency_plus: 1500,
};

function estimateTokensForCost(text: string) {
  return Math.ceil(text.length / 3);
}

async function getLatestApprovedArtifact(
  supabaseClient: ReturnType<typeof createClient>,
  clientId: string,
  artifactType: "strategy_recommendation" | "strategy_plan_v2" | "creator_brief",
) {
  const { data, error } = await supabaseClient
    .from("strategy_artifacts_v2")
    .select("id, status, updated_at, version, content_json, assumptions, open_questions, confidence, citations, source_brief_id, source_agency_module_version_map")
    .eq("client_id", clientId)
    .eq("artifact_type", artifactType)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getLatestBrief(
  supabaseClient: ReturnType<typeof createClient>,
  clientId: string,
) {
  const { data, error } = await supabaseClient
    .from("client_operating_briefs_v2")
    .select("id, version, content_json")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureCreatorBrief(args: {
  supabaseClient: ReturnType<typeof createClient>;
  agencyId: string;
  clientId: string;
  userId: string;
  mode: "ideas" | "hook" | "caption" | "script" | "rewrite";
  platform?: string | null;
}) {
  const { supabaseClient, agencyId, clientId, userId, mode, platform } = args;
  const [briefRecord, approvedRecommendation, approvedPlan, latestCreatorBrief] = await Promise.all([
    getLatestBrief(supabaseClient, clientId),
    getLatestApprovedArtifact(supabaseClient, clientId, "strategy_recommendation"),
    getLatestApprovedArtifact(supabaseClient, clientId, "strategy_plan_v2"),
    getLatestApprovedArtifact(supabaseClient, clientId, "creator_brief"),
  ]);

  if (!briefRecord || !approvedRecommendation || !approvedPlan) {
    return { creatorBriefArtifact: null as any, creatorBriefContext: null as string | null };
  }

  const latestBody = latestCreatorBrief?.content_json?.body as Record<string, unknown> | undefined;
  const latestMode = typeof latestBody?.requested_output === "object" && latestBody?.requested_output && typeof (latestBody.requested_output as Record<string, unknown>).mode === "string"
    ? String((latestBody.requested_output as Record<string, unknown>).mode)
    : null;
  const latestPlatform = typeof latestBody?.requested_output === "object" && latestBody?.requested_output && typeof (latestBody.requested_output as Record<string, unknown>).platform === "string"
    ? String((latestBody.requested_output as Record<string, unknown>).platform)
    : null;
  const briefMatches =
    latestCreatorBrief &&
    latestCreatorBrief.source_brief_id === briefRecord.id &&
    latestMode === mode &&
    latestPlatform === (platform?.trim() || latestPlatform);

  if (briefMatches) {
    return {
      creatorBriefArtifact: latestCreatorBrief,
      creatorBriefContext: renderCreatorBriefPromptContext(latestCreatorBrief.content_json as any),
    };
  }

  const run = await createAgentRunV2({
    supabase: supabaseClient,
    agencyId,
    clientId,
    agentKey: "creator_brief_agent",
    lifecycleState: "production_active",
    startedByUserId: userId,
    inputRefs: {
      source_brief_id: briefRecord.id,
      recommendation_artifact_id: approvedRecommendation.id,
      strategy_plan_artifact_id: approvedPlan.id,
      requested_mode: mode,
      requested_platform: platform ?? null,
    },
  });

  try {
    const creatorBrief = buildCreatorBriefArtifact({
      briefVersion: Number(briefRecord.version ?? 1),
      agencyModuleVersions: (approvedPlan.source_agency_module_version_map as Record<string, number>) ?? {},
      brief: briefRecord.content_json as any,
      recommendationArtifact: approvedRecommendation.content_json as any,
      strategyPlanArtifact: approvedPlan.content_json as any,
      mode,
      platform,
    });

    const artifact = await createStrategyArtifactV2({
      supabase: supabaseClient,
      agencyId,
      clientId,
      artifactType: "creator_brief",
      status: "approved",
      sourceBriefId: briefRecord.id,
      agencyModuleVersionMap: (approvedPlan.source_agency_module_version_map as Record<string, number>) ?? {},
      contentJson: creatorBrief as unknown as Record<string, unknown>,
      assumptions: creatorBrief.assumptions,
      openQuestions: creatorBrief.open_questions,
      citations: creatorBrief.citations,
      confidence: creatorBrief.confidence,
      generatedByRunId: run.id,
      createdBy: userId,
    });

    const evaluation = evaluateCreatorBriefArtifact(creatorBrief);
    await createArtifactEvaluationV2({
      supabase: supabaseClient,
      artifactId: artifact.id,
      agencyId,
      clientId,
      evaluatorKey: "creator_brief_gate_v2",
      result: evaluation.result,
      score: evaluation.score,
      findings: evaluation.findings,
      metadata: {
        requested_mode: mode,
        requested_platform: platform ?? null,
        source_recommendation_artifact_id: approvedRecommendation.id,
        source_strategy_plan_artifact_id: approvedPlan.id,
      },
    });

    await finalizeAgentRunV2({
      supabase: supabaseClient,
      runId: run.id,
      status: "completed",
      outputArtifactId: artifact.id,
      traceJson: {
        derived_from_approved_strategy: true,
        requested_mode: mode,
        requested_platform: platform ?? null,
      },
    });

    return {
      creatorBriefArtifact: artifact,
      creatorBriefContext: renderCreatorBriefPromptContext(creatorBrief),
    };
  } catch (error) {
    await finalizeAgentRunV2({
      supabase: supabaseClient,
      runId: run.id,
      status: "failed",
      failureReason: error instanceof Error ? error.message : "creator_brief_generation_failed",
    });
    throw error;
  }
}

async function enforceApprovedStrategyGate(
  supabaseClient: ReturnType<typeof createClient>,
  clientId: string,
  agencyId: string,
) {
  const { data: clientRecord, error: clientError } = await supabaseClient
    .from("clients")
    .select("id, agency_id")
    .eq("id", clientId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!clientRecord) {
    return new Response(JSON.stringify({
      success: false,
      code: "CLIENT_NOT_FOUND",
      error: "Client not found",
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [approvedRecommendation, approvedPlan] = await Promise.all([
    getLatestApprovedArtifact(supabaseClient, clientId, "strategy_recommendation"),
    getLatestApprovedArtifact(supabaseClient, clientId, "strategy_plan_v2"),
  ]);

  const missingApprovals = [
    approvedRecommendation ? null : "strategy_recommendation",
    approvedPlan ? null : "strategy_plan_v2",
  ].filter(Boolean);

  if (missingApprovals.length === 0) return null;

  return new Response(JSON.stringify({
    success: false,
    code: "STRATEGY_APPROVAL_REQUIRED",
    error: "Approved strategy recommendation and plan are required before AI content generation can run.",
    deep_link: `/clients/${clientId}?tab=strategy`,
    missing_approvals: missingApprovals,
  }), {
    status: 412,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractUsageFromRaw(raw: unknown) {
  const usage = (raw as any)?.usage;
  const inputTokens = usage?.prompt_tokens ?? usage?.input_tokens;
  const outputTokens = usage?.completion_tokens ?? usage?.output_tokens;
  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return undefined;
  return { inputTokens, outputTokens };
}

async function sha256Hex(input: string) {
  const buffer = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: { method: string; headers: { get: (arg0: string) => any; }; json: () => PromiseLike<{ mode: any; project_id: any; client_id: any; platform: any; brand_context: any; input_text: any; }> | { mode: any; project_id: any; client_id: any; platform: any; brand_context: any; input_text: any; }; }) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const guardResponse = getEndpointGuardResponse("generate-ai-content", corsHeaders);
    if (guardResponse) return guardResponse;

    console.log('[AI-CONTENT] Function invoked');
    
    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[AI-CONTENT] Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[AI-CONTENT] Missing Authorization header');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authentication required - please log in again' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client using service role for reliable auth in edge functions
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '');

    // Authenticate user
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;

    if (userError || !user) {
      console.error('[AI-CONTENT] Auth failed:', userError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authentication failed - session may be expired' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[AI-CONTENT] User authenticated:', user.id);

    // Parse request body
    const {
      mode, 
      project_id, 
      client_id, 
      platform, 
      brand_context, 
      input_text 
    } = await req.json();

    // Validate mode
    const validModes = ['ideas', 'hook', 'caption', 'script', 'rewrite'];
    if (!mode || !validModes.includes(mode)) {
      return new Response(JSON.stringify({ 
        success: false,
        error: `Invalid mode. Must be one of: ${validModes.join(', ')}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!client_id) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'client_id is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up agency
    const { data: agencyMember, error: agencyError } = await supabaseClient
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', user.id)
      .single();

    if (agencyError || !agencyMember) {
      console.error('[AI-CONTENT] Agency lookup failed:', agencyError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No agency found for this user' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const agency_id = agencyMember.agency_id;
    console.log('[AI-CONTENT] Agency found:', agency_id);

    const activationGateResponse = await enforceAgencyAgentActivation({
      supabaseClient,
      agencyId: agency_id,
      agentClass: "creator",
      requiredMode: "internal_assist_only",
      corsHeaders,
    });
    if (activationGateResponse) {
      console.warn("[AI-CONTENT] Creator activation gate blocked generation", { agency_id, client_id });
      return activationGateResponse;
    }

    const approvalGateResponse = await enforceApprovedStrategyGate(supabaseClient, client_id, agency_id);
    if (approvalGateResponse) {
      console.warn("[AI-CONTENT] Strategy approval gate blocked generation", { agency_id, client_id });
      return approvalGateResponse;
    }

    const { creatorBriefArtifact, creatorBriefContext } = await ensureCreatorBrief({
      supabaseClient,
      agencyId: agency_id,
      clientId: client_id,
      userId: user.id,
      mode,
      platform,
    });

    // Check subscription and quota
    const { data: agency } = await supabaseClient
      .from('agencies')
      .select('user_id')
      .eq('id', agency_id)
      .single();

    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('plan_type')
      .eq('user_id', agency?.user_id || user.id)
      .single();

    const planType = subscription?.plan_type || 'free';
    const monthlyQuota = PLAN_QUOTAS[planType] || PLAN_QUOTAS.free;

    // Check current month's usage
    const { data: usageCount } = await supabaseClient
      .rpc('get_monthly_ai_usage', { p_agency_id: agency_id });

    if (usageCount && usageCount >= monthlyQuota) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Monthly quota exceeded. You've used ${usageCount} of ${monthlyQuota} generations.`, 
          quota: monthlyQuota,
          used: usageCount 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const canonicalBrandContext = creatorBriefArtifact
      ? renderCreatorBriefPromptContext(creatorBriefArtifact.content_json as any, brand_context || creatorBriefContext || undefined)
      : [creatorBriefContext, brand_context].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join("\n\n");

    console.log('[AI-CONTENT] Calling AI router...');
    const startTime = Date.now();
    let suggestions;
    let aiResult: any = null;
    try {
      aiResult = await ai.run({
        taskType: TaskType.CONTENT_IDEAS,
        input: "",
        context: { agencyId: agency_id, clientId: client_id, userId: user.id, environment: "prod", supabase: supabaseClient },
        metadata: {
          mode,
          platform,
          brand_context: canonicalBrandContext,
          input_text,
        },
      });
      suggestions = aiResult.output ?? [];
      // TODO(governance): before any generated suggestion is published directly,
      // call gradeAgainstGovernance from ../_shared/answer-grading.ts and persist ai_gradings.
    } catch (e) {
      console.error('[AI-CONTENT] AI generation failed:', e);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'AI generation failed. Please try again.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const latencyMs = Date.now() - startTime;
    const usage = extractUsageFromRaw(aiResult?.raw);
    const runtimeModel =
      aiResult?.meta?.model ?? (aiResult?.meta?.provider === "gemini" ? "gemini-flash-latest" : "gpt-4o-mini");
    const inputText = `${input_text ?? ""}\n\n${canonicalBrandContext ?? ""}`;
    const outputText = JSON.stringify(suggestions ?? []);
    const tokensIn = usage?.inputTokens ?? estimateTokensForCost(inputText);
    const tokensOut = usage?.outputTokens ?? estimateTokensForCost(outputText);
    const costUsd = calculateCost(aiResult?.meta?.provider ?? "openai", runtimeModel, tokensIn, tokensOut);
    const costEstimationMethod = usage ? "token_based" : "estimate_chars_div3";
    const inputHash = await sha256Hex(inputText);
    const outputHash = await sha256Hex(outputText);

    await logUsage(supabaseClient, {
      taskType: TaskType.CONTENT_IDEAS,
      endpoint: "generate-ai-content",
      provider: aiResult?.meta?.provider ?? "openai",
      model: runtimeModel,
      agencyId: agency_id,
      clientId: client_id,
      latencyMs,
      tokensIn,
      tokensOut,
      unknown: false,
      success: true,
      errorCode: null,
    });

    await supabaseClient.from("ai_runs").insert({
      agency_id,
      client_id,
      user_id: user.id,
      prompt_id: null,
      prompt_version: null,
      model: runtimeModel,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      success: true,
      citations: {},
      unknown: false,
      escalate_to_human: false,
      escalation_reason: null,
      metadata: {
        cost_estimation_method: costEstimationMethod,
        mode,
        project_id: project_id ?? null,
        creator_brief_artifact_id: creatorBriefArtifact?.id ?? null,
        input_hash: inputHash,
        output_hash: outputHash,
        input_chars: inputText.length,
        output_chars: outputText.length,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        legacy_source: "generate-ai-content",
      },
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: budgetRow } = await supabaseClient
      .from("ai_budgets")
      .select("id")
      .eq("agency_id", agency_id)
      .eq("month_yyyy_mm", currentMonth)
      .maybeSingle();

    if (budgetRow?.id) {
      await incrementBudget(supabaseClient, agency_id, currentMonth, costUsd, false);
    }

    // Legacy prompt logging disabled; store hashes + metadata in ai_runs instead.

    // Update project fields based on mode (if project_id provided)
    if (project_id) {
      const serviceRoleClient = createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
      );

      // Fetch current project data
      const { data: project } = await serviceRoleClient
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .single();

      if (project) {
        let updateData: any = {};

        switch (mode) {
          case 'ideas': {
            // Append to ideas array (store as JSONB array)
            const currentIdeas = project.ideas || [];
            const newIdeas = suggestions.map((s: any) => ({
              title: s.title,
              description: s.description,
              generated_at: new Date().toISOString(),
            }));
            updateData.ideas = [...currentIdeas, ...newIdeas];
            break;
          }

          case 'hook': {
            // Append to hooks array
            const currentHooks = project.hooks || [];
            const newHooks = suggestions.map((s: any) => s.text);
            updateData.hooks = [...currentHooks, ...newHooks];
            break;
          }

          case 'caption': {
            // Update platform_captions JSON
            const currentCaptions = project.platform_captions || {};
            if (platform) {
              currentCaptions[platform] = suggestions[0]?.text || '';
            }
            updateData.platform_captions = currentCaptions;
            break;
          }

          case 'script': {
            // Update script field
            updateData.script = suggestions[0]?.text || '';
            break;
          }

          case 'rewrite': {
            // For rewrite, we return suggestions but don't auto-update
            // User manually selects which version to use
            break;
          }
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await serviceRoleClient
            .from('projects')
            .update(updateData)
            .eq('id', project_id);

          if (updateError) {
            console.error('[AI-CONTENT] Failed to update project:', updateError);
          } else {
            console.log('[AI-CONTENT] Project updated successfully');
          }
        }
      }
    }

    console.log('[AI-CONTENT] Success!');
    return new Response(
      JSON.stringify({
        success: true,
        mode,
        suggestions,
        creator_brief_artifact_id: creatorBriefArtifact?.id ?? null,
        usage: {
          used: (usageCount || 0) + 1,
          quota: monthlyQuota,
          remaining: monthlyQuota - (usageCount || 0) - 1,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[AI-CONTENT] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
