import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }), 
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, platform, tone, keywords, niche, contentPillars, trends } = await req.json();

    if (!type || !['caption', 'idea'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid generation type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's agency
    const { data: agencyMember } = await supabaseClient
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', user.id)
      .single();

    if (!agencyMember) {
      return new Response(JSON.stringify({ error: 'No agency found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get agency subscription plan
    const { data: agency } = await supabaseClient
      .from('agencies')
      .select('user_id')
      .eq('id', agencyMember.agency_id)
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
      .rpc('get_monthly_ai_usage', { p_agency_id: agencyMember.agency_id });

    if (usageCount && usageCount >= monthlyQuota) {
      return new Response(
        JSON.stringify({ 
          error: 'Monthly quota exceeded', 
          quota: monthlyQuota,
          used: usageCount 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate content using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'caption') {
      systemPrompt = `You are an expert social media content creator. Generate engaging, platform-specific captions with hashtags.`;
      userPrompt = `Generate 3 caption variations for ${platform} with a ${tone} tone. Keywords: ${keywords}. 
      
For each caption, provide:
1. The caption text (keep it concise and engaging)
2. 5-8 relevant hashtags

Return as JSON array: [{"caption": "...", "hashtags": ["tag1", "tag2", ...]}]`;
    } else {
      systemPrompt = `You are a creative content strategist. Generate innovative content ideas based on niche, pillars, and trends.`;
      userPrompt = `Generate 5 content ideas for a ${niche} business. Content pillars: ${contentPillars}. ${trends ? `Current trends: ${trends}` : ''}
      
For each idea, provide:
1. A catchy title
2. A brief description (1-2 sentences)
3. Suggested tags (2-4 tags)

Return as JSON array: [{"title": "...", "description": "...", "tags": ["tag1", "tag2", ...]}]`;
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service requires payment. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;

    // Parse the JSON response
    let parsedContent;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsedContent = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response');
    }

    // Track usage
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    await supabaseClient.from('ai_generation_usage').insert({
      user_id: user.id,
      agency_id: agencyMember.agency_id,
      generation_type: type,
      month_year: currentMonth,
    });

    return new Response(
      JSON.stringify({
        content: parsedContent,
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
    console.error('Error in generate-ai-content:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
