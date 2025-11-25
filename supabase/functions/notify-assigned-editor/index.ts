import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  asset_id: string;
  client_id: string;
  agency_id: string;
  uploader_id: string;
  title: string;
  content_type: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationRequest = await req.json();
    const { asset_id, client_id, agency_id, uploader_id, title, content_type } = body;

    console.log('Notifying editors about new raw upload:', { asset_id, client_id, title });

    // Get client details
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('name')
      .eq('id', client_id)
      .single();

    if (clientError) {
      console.error('Error fetching client:', clientError);
      throw clientError;
    }

    // Get uploader details
    const { data: uploader, error: uploaderError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', uploader_id)
      .single();

    if (uploaderError) {
      console.error('Error fetching uploader:', uploaderError);
    }

    // Get all editors and managers for this agency (Creator role and above)
    const { data: editors, error: editorsError } = await supabase
      .from('agency_members')
      .select('user_id, role, profiles!inner(email, full_name)')
      .eq('agency_id', agency_id)
      .in('role', ['owner', 'admin', 'manager']);

    if (editorsError) {
      console.error('Error fetching editors:', editorsError);
      throw editorsError;
    }

    console.log(`Found ${editors?.length || 0} editors to notify`);

    // Get agency branding for white-label emails
    const { data: branding } = await supabase
      .from('agency_branding')
      .select('email_sender_name, email_footer')
      .eq('agency_id', agency_id)
      .single();

    const senderName = branding?.email_sender_name || 'SMMAHUB';
    const emailFooter = branding?.email_footer || '';

    // Send email notifications to editors
    if (resendApiKey && editors && editors.length > 0) {
      const uploaderName = uploader?.full_name || uploader?.email || 'A team member';
      
      for (const editor of editors) {
        const editorEmail = (editor.profiles as any)?.email;
        const editorName = (editor.profiles as any)?.full_name || 'there';

        if (!editorEmail) continue;

        try {
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Raw Content Ready for Editing</h2>
              
              <p>Hi ${editorName},</p>
              
              <p><strong>${uploaderName}</strong> has uploaded new raw content that needs editing:</p>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
                <p style="margin: 5px 0;"><strong>Client:</strong> ${client.name}</p>
                <p style="margin: 5px 0;"><strong>Content Type:</strong> ${content_type.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</p>
              </div>
              
              <p>This content is now in the <strong>Raw</strong> stage of the pipeline and ready for your review.</p>
              
              <p style="margin-top: 30px;">
                <a href="${supabaseUrl.replace('https://', 'https://app.')}/clients/${client_id}" 
                   style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  View in Pipeline
                </a>
              </p>
              
              ${emailFooter ? `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">${emailFooter}</div>` : ''}
            </div>
          `;

          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${senderName} <notifications@smmahub.net>`,
              to: [editorEmail],
              subject: `New Raw Content: ${title}`,
              html: emailHtml,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error(`Failed to send email to ${editorEmail}:`, errorText);
          } else {
            console.log(`Email sent successfully to ${editorEmail}`);
          }
        } catch (emailError) {
          console.error(`Error sending email to ${editorEmail}:`, emailError);
        }
      }
    }

    // TODO: Create in-app notifications (when notification system is built)
    // For now, just log that we would create notifications
    console.log('In-app notifications would be created here');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notifications sent',
        notified_count: editors?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in notify-assigned-editor:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
