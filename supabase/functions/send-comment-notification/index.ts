import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[COMMENT-NOTIFICATION] Step 1: Function invoked');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    console.log('[COMMENT-NOTIFICATION] Step 2: Authenticating user...');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('[COMMENT-NOTIFICATION] Auth failed:', userError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[COMMENT-NOTIFICATION] Step 3: User authenticated:', user.id);
    console.log('[COMMENT-NOTIFICATION] Step 4: Parsing request body...');
    
    const { commentId, postId, clientId } = await req.json();

    if (!commentId || !postId || !clientId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get comment details
    const { data: comment, error: commentError } = await supabaseClient
      .from('post_comments')
      .select('*, posts(title, client_id)')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      console.error('[COMMENT-NOTIFICATION] Comment not found:', commentError);
      return new Response(
        JSON.stringify({ error: 'Comment not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get author details
    const { data: authorProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', comment.author_id)
      .single();

    // Check if author is a client portal user
    const { data: isClientUser } = await supabaseClient
      .from('client_portal_users')
      .select('id')
      .eq('user_id', comment.author_id)
      .eq('client_id', clientId)
      .maybeSingle();

    const authorType = isClientUser ? 'Client' : 'Agency';
    const authorName = authorProfile?.full_name || authorProfile?.email || 'Unknown User';

    // Get notification recipients
    let recipients: string[] = [];

    if (isClientUser) {
      // If client commented, notify agency members
      const { data: agencyMembers } = await supabaseClient
        .from('agency_members')
        .select('user_id')
        .eq('agency_id', comment.agency_id);

      if (agencyMembers) {
        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('email')
          .in('id', agencyMembers.map(m => m.user_id));
        
        recipients = profiles?.map(p => p.email).filter(Boolean) || [];
      }
    } else {
      // If agency commented, notify client portal users
      const { data: portalUsers } = await supabaseClient
        .from('client_portal_users')
        .select('email')
        .eq('client_id', clientId);

      recipients = portalUsers?.map(u => u.email).filter(Boolean) || [];
    }

    // Send email notifications
    if (recipients.length > 0) {
      console.log('[COMMENT-NOTIFICATION] Sending emails to:', recipients);
      
      await resend.emails.send({
        from: "Lovable <onboarding@resend.dev>",
        to: recipients,
        subject: `New comment from ${authorType} on "${comment.posts.title}"`,
        html: `
          <h2>New Comment on Post</h2>
          <p><strong>${authorName}</strong> (${authorType}) commented:</p>
          <blockquote style="border-left: 3px solid #ccc; padding-left: 1rem; margin: 1rem 0;">
            ${comment.content}
          </blockquote>
          <p>Post: <strong>${comment.posts.title}</strong></p>
          <p style="margin-top: 2rem; color: #666;">
            <small>This is an automated notification from your social media management platform.</small>
          </p>
        `,
      });

      console.log('[COMMENT-NOTIFICATION] Emails sent successfully');
    }

    return new Response(
      JSON.stringify({ success: true, recipients: recipients.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[COMMENT-NOTIFICATION] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
