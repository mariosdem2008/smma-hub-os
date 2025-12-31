// ============================================================================
// AI Onboarding Suggest Edge Function
// Generates contextual suggestions for onboarding questions
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface OnboardingProfile {
  q1_business_name?: string;
  q2_website?: string;
  q5_offer_type?: string;
  q6_offer_name?: string;
  q7_business_model?: string;
  q8_ideal_customer?: string;
  q9_pain_points?: string[];
  q10_desired_outcome?: string;
  q12_competitors?: { name: string; handle?: string; url?: string }[];
  ai_scan_result?: {
    extracted?: {
      niche?: string;
      audience?: string[];
      competitors?: { name: string; handle?: string; url?: string }[];
      differentiators?: string[];
      pain_points?: string[];
    };
  };
}

interface SuggestRequest {
  agency_id: string;
  client_id: string;
  step_id: 'q8' | 'q9' | 'q10' | 'q12' | 'q13';
  profile: OnboardingProfile;
}

interface Suggestion {
  id: string;
  label: string;
  confidence: number;
}

interface SuggestResponse {
  suggestions: Suggestion[];
  fallback_enabled: boolean;
}

// Generate suggestions using Claude
async function generateSuggestions(
  stepId: string,
  profile: OnboardingProfile,
  anthropicApiKey: string
): Promise<Suggestion[]> {
  const prompts: Record<string, string> = {
    q8: `Based on this business context, suggest 5-8 ideal customer personas:
Business: ${profile.q1_business_name || 'Unknown'}
Offer Type: ${profile.q5_offer_type || 'Unknown'}
Business Model: ${profile.q7_business_model || 'Unknown'}
Niche: ${profile.ai_scan_result?.extracted?.niche || 'Unknown'}

Return JSON array: [{"id": "unique_id", "label": "Customer persona description", "confidence": 0-100}]
Focus on specific, actionable personas. Higher confidence for more specific personas.`,

    q9: `Based on this ideal customer, suggest 6-10 pain points they might have:
Ideal Customer: ${profile.q8_ideal_customer || 'Unknown'}
Business: ${profile.q1_business_name || 'Unknown'}
Offer: ${profile.q6_offer_name || 'Unknown'}
${profile.ai_scan_result?.extracted?.pain_points?.length ? `Detected pain points: ${profile.ai_scan_result.extracted.pain_points.join(', ')}` : ''}

Return JSON array: [{"id": "unique_id", "label": "Pain point description", "confidence": 0-100}]
Focus on specific, relatable pain points. Higher confidence for more common/validated pain points.`,

    q10: `Based on these pain points, suggest 5-8 desired outcomes:
Pain Points: ${profile.q9_pain_points?.join(', ') || 'Unknown'}
Ideal Customer: ${profile.q8_ideal_customer || 'Unknown'}
Offer: ${profile.q6_offer_name || 'Unknown'}

Return JSON array: [{"id": "unique_id", "label": "Desired outcome description", "confidence": 0-100}]
Focus on transformational outcomes that directly address the pain points.`,

    q12: `Suggest 5-10 potential competitors for this business:
Business: ${profile.q1_business_name || 'Unknown'}
Website: ${profile.q2_website || 'Unknown'}
Offer: ${profile.q6_offer_name || 'Unknown'}
${profile.ai_scan_result?.extracted?.competitors?.length ? `Detected competitors: ${profile.ai_scan_result.extracted.competitors.map(c => c.name).join(', ')}` : ''}

Return JSON array: [{"id": "unique_id", "label": "Competitor name", "confidence": 0-100}]
Include both direct and indirect competitors. Higher confidence for more well-known competitors.`,

    q13: `Suggest 6-8 differentiators for this business:
Business: ${profile.q1_business_name || 'Unknown'}
Offer: ${profile.q6_offer_name || 'Unknown'}
Competitors: ${profile.q12_competitors?.map(c => c.name).join(', ') || 'Unknown'}
${profile.ai_scan_result?.extracted?.differentiators?.length ? `Detected differentiators: ${profile.ai_scan_result.extracted.differentiators.join(', ')}` : ''}

Return JSON array: [{"id": "unique_id", "label": "Differentiator description", "confidence": 0-100}]
Focus on unique, provable differentiators. Higher confidence for more unique/verifiable ones.`,
  };

  const prompt = prompts[stepId];
  if (!prompt) {
    return [];
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt + '\n\nReturn only valid JSON array, no other text.',
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]);
      return suggestions.map((s: any, i: number) => ({
        id: s.id || `suggestion-${i}`,
        label: s.label,
        confidence: s.confidence || 70,
      }));
    }

    return [];
  } catch (error) {
    console.error('AI suggestion error:', error);
    return [];
  }
}

// Fallback suggestions if AI fails
function getFallbackSuggestions(stepId: string): Suggestion[] {
  const fallbacks: Record<string, Suggestion[]> = {
    q8: [
      { id: 'sbo', label: 'Small business owners', confidence: 60 },
      { id: 'mm', label: 'Marketing managers', confidence: 60 },
      { id: 'sf', label: 'Startup founders', confidence: 60 },
      { id: 'eco', label: 'E-commerce brand owners', confidence: 60 },
      { id: 'edm', label: 'Enterprise decision makers', confidence: 60 },
    ],
    q9: [
      { id: 'le', label: 'Low engagement on social media', confidence: 60 },
      { id: 'ncs', label: 'No clear content strategy', confidence: 60 },
      { id: 'ip', label: 'Inconsistent posting schedule', confidence: 60 },
      { id: 'nvg', label: 'No visible growth', confidence: 60 },
      { id: 'lq', label: 'Low quality leads', confidence: 60 },
    ],
    q10: [
      { id: 'mr', label: 'More revenue', confidence: 60 },
      { id: 'ml', label: 'More leads', confidence: 60 },
      { id: 'ba', label: 'Better brand awareness', confidence: 60 },
      { id: 'mc', label: 'More customers', confidence: 60 },
      { id: 'ts', label: 'Time savings', confidence: 60 },
    ],
    q12: [
      { id: 'c1', label: 'Direct competitor in your niche', confidence: 50 },
      { id: 'c2', label: 'Industry leader', confidence: 50 },
      { id: 'c3', label: 'Local competitor', confidence: 50 },
    ],
    q13: [
      { id: 'ai', label: 'AI-powered solutions', confidence: 60 },
      { id: 'wg', label: 'White-glove service', confidence: 60 },
      { id: 'is', label: 'Industry specialization', confidence: 60 },
      { id: 'fp', label: 'Faster delivery', confidence: 60 },
      { id: 'pr', label: 'Proven track record', confidence: 60 },
    ],
  };

  return fallbacks[stepId] || [];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: SuggestRequest = await req.json();
    const { agency_id, client_id, step_id, profile } = body;

    if (!agency_id || !client_id || !step_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: agency_id, client_id, step_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

    let suggestions: Suggestion[] = [];
    let fallback_enabled = false;

    if (anthropicApiKey) {
      suggestions = await generateSuggestions(step_id, profile, anthropicApiKey);
    }

    // Use fallback if no AI suggestions
    if (suggestions.length === 0) {
      suggestions = getFallbackSuggestions(step_id);
      fallback_enabled = true;
    }

    const response: SuggestResponse = {
      suggestions,
      fallback_enabled,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Suggest error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
