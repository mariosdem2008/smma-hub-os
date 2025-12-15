import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

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

serve(async (req: { method: string; headers: { get: (arg0: string) => any; }; json: () => PromiseLike<{ mode: any; project_id: any; client_id: any; platform: any; brand_context: any; input_text: any; }> | { mode: any; project_id: any; client_id: any; platform: any; brand_context: any; input_text: any; }; }) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Get OpenAI API Key
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[AI-CONTENT] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'AI service not configured. Please contact support.' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build prompts based on mode
    let systemPrompt = '';
    let userPrompt = '';
    const brandInfo = brand_context || '';

    switch (mode) {
      case 'ideas':
        systemPrompt = 'You are a creative content strategist. Generate innovative, actionable content ideas.';
        userPrompt = `Generate 5 content ideas for ${platform || 'social media'}. ${brandInfo}
        
Return as JSON array: [{"title": "...", "description": "..."}]`;
        break;

      case 'hook':
        systemPrompt = 'You are an expert copywriter. Generate attention-grabbing hooks for social media content.';
        userPrompt = `Generate 5 powerful hooks for ${platform || 'social media'} content. ${brandInfo}
        
Return as JSON array: [{"text": "..."}]`;
        break;

      case 'caption':
        systemPrompt = 'You are an expert social media content creator. Generate engaging captions optimized for the platform.';
        userPrompt = `Generate 3 captions for ${platform || 'social media'}. ${brandInfo}
        
Return as JSON array: [{"text": "..."}]`;
        break;

      case 'script':
        systemPrompt = 'You are a video script writer. Generate engaging video scripts with clear structure.';
        userPrompt = `Generate 3 video script variations for ${platform || 'social media'}. ${brandInfo}
        
Each script should have:
- Hook (first 3 seconds)
- Body (main content)
- CTA (call to action)

Return as JSON array: [{"text": "..."}]`;
        break;

      case 'rewrite':
        systemPrompt = 'You are an expert editor. Improve the given text while maintaining its core message.';
        userPrompt = `Improve this text for ${platform || 'social media'}: "${input_text}"
        
${brandInfo}

Return as JSON array with 3 variations: [{"text": "..."}]`;
        break;
    }

    console.log('[AI-CONTENT] Calling OpenAI API...');
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
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'AI generation failed. Please try again.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AI-CONTENT] Parsing AI response...');
    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;

    // Parse the JSON response
    let suggestions;
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      suggestions = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[AI-CONTENT] Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to parse AI response. Please try again.' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Store in ai_history for audit
    const inputPayload = {
      mode,
      project_id,
      client_id,
      platform,
      brand_context,
      input_text,
    };

    const outputPayload = {
      suggestions,
      generated_at: new Date().toISOString(),
    };

    const { error: historyError } = await supabaseClient
      .from('ai_history')
      .insert({
        agency_id,
        client_id,
        project_id: project_id || null,
        mode,
        input: inputPayload,
        output: outputPayload,
      });

    if (historyError) {
      console.error('[AI-CONTENT] Failed to store history:', historyError);
    }

    // Track usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { error: usageError } = await supabaseClient.from('ai_generation_usage').insert({
      user_id: user.id,
      agency_id,
      generation_type: mode,
      month_year: currentMonth,
    });

    if (usageError) {
      console.error('[AI-CONTENT] Failed to record usage:', usageError);
    }

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
