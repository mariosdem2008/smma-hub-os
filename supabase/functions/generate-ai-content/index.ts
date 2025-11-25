import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log('[AI-CONTENT] Step 1: Function invoked');
    
    // Supabase automatically validates JWT and provides auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log('[AI-CONTENT] Step 2: Authenticating user...');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('[AI-CONTENT] Auth failed:', userError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[AI-CONTENT] Step 3: User authenticated:', user.id);

    console.log('[AI-CONTENT] Step 4: Parsing request body...');
    const { type, platform, tone, keywords, niche, contentPillars, trends, brandVoice, platforms, clientId } = await req.json();

    if (!type || !['caption', 'idea', 'caption_variants'].includes(type)) {
      console.error('[AI-CONTENT] Invalid type:', type);
      return new Response(JSON.stringify({ error: 'Invalid generation type. Must be "caption", "idea", or "caption_variants"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[AI-CONTENT] Step 5: Looking up agency...');
    const { data: agencyMember, error: agencyError } = await supabaseClient
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', user.id)
      .single();

    if (agencyError || !agencyMember) {
      console.error('[AI-CONTENT] Agency lookup failed:', agencyError);
      return new Response(JSON.stringify({ error: 'No agency found for this user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[AI-CONTENT] Step 6: Agency found:', agencyMember.agency_id);

    console.log('[AI-CONTENT] Step 7: Checking subscription and quota...');
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
    console.log('[AI-CONTENT] Plan type:', planType, 'Quota:', monthlyQuota);

    // Check current month's usage
    const { data: usageCount } = await supabaseClient
      .rpc('get_monthly_ai_usage', { p_agency_id: agencyMember.agency_id });

    console.log('[AI-CONTENT] Current usage:', usageCount, '/', monthlyQuota);

    if (usageCount && usageCount >= monthlyQuota) {
      console.warn('[AI-CONTENT] Quota exceeded');
      return new Response(
        JSON.stringify({ 
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

    console.log('[AI-CONTENT] Step 8: Preparing OpenAI request...');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[AI-CONTENT] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Please contact support.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'caption_variants') {
      systemPrompt = 'You are an expert social media content creator. Generate engaging caption variations optimized for each platform.';
      const platformNames = platforms.join(', ');
      userPrompt = `Generate 3 caption variations (short, medium, long) for posting on: ${platformNames}.

For each variation, provide:
1. The caption text appropriate for the platform(s)
2. Length indicator (short/medium/long)

Short: 50-100 characters, punchy and direct
Medium: 100-300 characters, engaging with context
Long: 300-500 characters, detailed storytelling

Return as JSON array: [{"caption": "...", "length": "short/medium/long"}]`;
    } else if (type === 'caption') {
      const brandVoiceContext = brandVoice 
        ? `\n\nIMPORTANT: Apply this brand voice:\n- Tone: ${brandVoice.tone.join(', ')}\n- Key vocabulary: ${brandVoice.vocabulary.slice(0, 10).join(', ')}\n- Writing rules: ${brandVoice.rules.do.slice(0, 3).join('; ')}`
        : '';
      
      systemPrompt = `You are an expert social media content creator. Generate engaging, platform-specific captions with hashtags.${brandVoiceContext}`;
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

    console.log('[AI-CONTENT] Step 9: Calling OpenAI API...');
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[AI-CONTENT] OpenAI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service is currently rate limited. Please try again in a few moments.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'AI service authentication failed. Please contact support.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI generation failed. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI-CONTENT] Step 10: Parsing AI response...');
    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;

    // Parse the JSON response
    let parsedContent;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsedContent = JSON.parse(jsonStr);
      console.log('[AI-CONTENT] Step 11: Content parsed successfully');
    } catch (e) {
      console.error('[AI-CONTENT] Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response. Please try again.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Track usage
    console.log('[AI-CONTENT] Step 12: Recording usage...');
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { error: usageError } = await supabaseClient.from('ai_generation_usage').insert({
      user_id: user.id,
      agency_id: agencyMember.agency_id,
      generation_type: type,
      month_year: currentMonth,
    });

    if (usageError) {
      console.error('[AI-CONTENT] Failed to record usage:', usageError);
    }

    console.log('[AI-CONTENT] Step 13: Success! Returning content');
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
    console.error('[AI-CONTENT] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
