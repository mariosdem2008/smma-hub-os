import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[BRAND-VOICE] Step 1: Function invoked');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log('[BRAND-VOICE] Step 2: Authenticating user...');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('[BRAND-VOICE] Auth failed:', userError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[BRAND-VOICE] Step 3: User authenticated:', user.id);
    console.log('[BRAND-VOICE] Step 4: Parsing request body...');
    
    const { textSamples, websiteUrl, clientId, agencyId } = await req.json();

    if (!textSamples || textSamples.length === 0) {
      console.error('[BRAND-VOICE] No text samples provided');
      return new Response(
        JSON.stringify({ error: 'At least one text sample is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!clientId || !agencyId) {
      console.error('[BRAND-VOICE] Missing clientId or agencyId');
      return new Response(
        JSON.stringify({ error: 'Client ID and Agency ID are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[BRAND-VOICE] Step 5: Preparing OpenAI request...');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[BRAND-VOICE] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Please contact support.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Combine text samples into analysis prompt
    const combinedText = textSamples.join('\n\n---\n\n');
    const websiteContext = websiteUrl ? `\nWebsite URL for context: ${websiteUrl}` : '';

    const systemPrompt = `You are a brand voice analysis expert. Analyze the provided text samples and extract:
1. 3-5 tone descriptors (e.g., "professional", "friendly", "bold")
2. A vocabulary list of characteristic words and phrases used
3. Writing rules with "Do" and "Don't" guidelines
4. Generate 1 example caption in the extracted brand voice

Return a JSON object with this structure:
{
  "tone": ["descriptor1", "descriptor2", ...],
  "vocabulary": ["word1", "phrase1", ...],
  "rules": {
    "do": ["rule1", "rule2", ...],
    "dont": ["rule1", "rule2", ...]
  },
  "examples": ["example caption 1"]
}`;

    const userPrompt = `Analyze these text samples and extract the brand voice:${websiteContext}

${combinedText}

Provide a comprehensive brand voice analysis.`;

    console.log('[BRAND-VOICE] Step 6: Calling OpenAI API...');
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
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[BRAND-VOICE] OpenAI API error:', aiResponse.status, errorText);
      
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
        JSON.stringify({ error: 'Brand voice generation failed. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[BRAND-VOICE] Step 7: Parsing AI response...');
    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;

    let brandVoice;
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      brandVoice = JSON.parse(jsonStr);
      console.log('[BRAND-VOICE] Step 8: Brand voice parsed successfully');
    } catch (e) {
      console.error('[BRAND-VOICE] Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response. Please try again.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Save to database
    console.log('[BRAND-VOICE] Step 9: Saving to database...');
    const { error: upsertError } = await supabaseClient
      .from('client_brand_voice')
      .upsert({
        client_id: clientId,
        agency_id: agencyId,
        tone: brandVoice.tone,
        vocabulary: brandVoice.vocabulary,
        rules: brandVoice.rules,
        examples: brandVoice.examples,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'client_id'
      });

    if (upsertError) {
      console.error('[BRAND-VOICE] Failed to save brand voice:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save brand voice. Please try again.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[BRAND-VOICE] Step 10: Success! Returning brand voice');
    return new Response(
      JSON.stringify({ brandVoice }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[BRAND-VOICE] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
