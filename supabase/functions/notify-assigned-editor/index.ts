import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  // For project assignment notifications
  project_id?: string;
  assigned_member_id?: string;
  project_title?: string;
  
  // For legacy raw upload notifications
  asset_id?: string;
  client_id?: string;
  agency_id?: string;
  uploader_id?: string;
  title?: string;
  content_type?: string;
  
  // Notification type indicator
  notification_type?: 'project_assigned' | 'raw_upload' | 'stage_changed' | 'comment_added' | 'client_action';
  
  // Additional context
  new_stage?: string;
  old_stage?: string;
  comment_preview?: string;
  action?: 'approved' | 'rejected';
  rejection_reason?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationRequest = await req.json();
    const notificationType = body.notification_type || (body.project_id && body.assigned_member_id ? 'project_assigned' : 'raw_upload');

    console.log("Processing notification:", { notificationType, body });

    // Handle project assignment notification
    if (notificationType === 'project_assigned' && body.project_id && body.assigned_member_id) {
      return await handleProjectAssignment(supabase, body, brevoApiKey, resendApiKey);
    }

    // Handle stage change notification
    if (notificationType === 'stage_changed' && body.project_id) {
      return await handleStageChange(supabase, body, brevoApiKey, resendApiKey);
    }

    // Handle comment added notification
    if (notificationType === 'comment_added' && body.project_id) {
      return await handleCommentAdded(supabase, body, brevoApiKey, resendApiKey);
    }

    // Handle client action (approve/reject) notification
    if (notificationType === 'client_action' && body.project_id) {
      return await handleClientAction(supabase, body, brevoApiKey, resendApiKey);
    }

    // Legacy: Handle raw upload notification
    return await handleRawUpload(supabase, body, resendApiKey);
  } catch (error) {
    console.error("Error in notify-assigned-editor:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleProjectAssignment(
  supabase: any, 
  body: NotificationRequest, 
  brevoApiKey: string | undefined,
  resendApiKey: string | undefined
) {
  const { project_id, assigned_member_id, project_title } = body;

  // Get the assigned member details
  const { data: member, error: memberError } = await supabase
    .from("agency_members")
    .select(`
      id,
      user_id,
      agency_id,
      profile:profiles(full_name, email)
    `)
    .eq("id", assigned_member_id)
    .single();

  if (memberError || !member) {
    console.error("Error fetching member:", memberError);
    throw new Error("Member not found");
  }

  // Get project details
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      id,
      title,
      client_id,
      agency_id,
      clients(name)
    `)
    .eq("id", project_id)
    .single();

  if (projectError || !project) {
    console.error("Error fetching project:", projectError);
    throw new Error("Project not found");
  }

  const clientName = project.clients?.name || "Unknown Client";
  const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
  const memberEmail = profile?.email;
  const memberName = profile?.full_name || memberEmail?.split('@')[0] || 'Team Member';

  // Create in-app notification
  await supabase.from("notifications").insert({
    agency_id: member.agency_id,
    user_type: "agency_member",
    user_id: member.user_id,
    type: "project_assigned",
    project_id: project_id,
    payload: {
      project_title: project_title || project.title,
      client_name: clientName,
      message: `You have been assigned to project "${project_title || project.title}"`,
    },
  });

  // Send email notification
  if (memberEmail && (brevoApiKey || resendApiKey)) {
    await sendEmail({
      to: memberEmail,
      toName: memberName,
      subject: `New Project Assignment: ${project_title || project.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">You've Been Assigned to a Project</h2>
          <p>Hi ${memberName},</p>
          <p>You have been assigned to work on the project "<strong>${project_title || project.title}</strong>" for client <strong>${clientName}</strong>.</p>
          <p>Log in to SMMAHUB to view the project details and get started.</p>
          <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              Project: ${project_title || project.title}<br/>
              Client: ${clientName}
            </p>
          </div>
        </div>
      `,
      brevoApiKey,
      resendApiKey,
    });
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleStageChange(
  supabase: any,
  body: NotificationRequest,
  brevoApiKey: string | undefined,
  resendApiKey: string | undefined
) {
  const { project_id, new_stage, old_stage } = body;

  // Get project with assigned member
  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, title, agency_id, client_id, assigned_to,
      clients(name),
      assigned_member:agency_members!projects_assigned_to_fkey(
        user_id,
        profile:profiles(full_name, email)
      )
    `)
    .eq("id", project_id)
    .single();

  if (!project) return new Response(JSON.stringify({ success: false }), { headers: corsHeaders });

  // Notify assigned member about stage change
  if (project.assigned_member) {
    const profile = Array.isArray(project.assigned_member.profile) 
      ? project.assigned_member.profile[0] 
      : project.assigned_member.profile;

    await supabase.from("notifications").insert({
      agency_id: project.agency_id,
      user_type: "agency_member",
      user_id: project.assigned_member.user_id,
      type: "stage_changed",
      project_id: project_id,
      payload: {
        project_title: project.title,
        client_name: project.clients?.name,
        old_stage,
        new_stage,
        message: `Project "${project.title}" moved to ${new_stage}`,
      },
    });

    // Send email for important stage changes
    if (profile?.email && (new_stage === 'client_review' || new_stage === 'approved' || new_stage === 'scheduled')) {
      await sendEmail({
        to: profile.email,
        toName: profile.full_name || 'Team Member',
        subject: `Project Update: ${project.title} - ${new_stage}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Project Stage Updated</h2>
            <p>Project "<strong>${project.title}</strong>" has been moved to <strong>${new_stage}</strong>.</p>
          </div>
        `,
        brevoApiKey,
        resendApiKey,
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleCommentAdded(
  supabase: any,
  body: NotificationRequest,
  brevoApiKey: string | undefined,
  resendApiKey: string | undefined
) {
  const { project_id, comment_preview } = body;

  // Get project details
  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, title, agency_id, client_id, assigned_to,
      clients(name),
      assigned_member:agency_members!projects_assigned_to_fkey(
        user_id,
        profile:profiles(full_name, email)
      )
    `)
    .eq("id", project_id)
    .single();

  if (!project) return new Response(JSON.stringify({ success: false }), { headers: corsHeaders });

  // Notify assigned member
  if (project.assigned_member) {
    await supabase.from("notifications").insert({
      agency_id: project.agency_id,
      user_type: "agency_member",
      user_id: project.assigned_member.user_id,
      type: "comment_added",
      project_id: project_id,
      payload: {
        project_title: project.title,
        client_name: project.clients?.name,
        comment_preview: comment_preview?.substring(0, 100),
        message: `New comment on "${project.title}"`,
      },
    });
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleClientAction(
  supabase: any,
  body: NotificationRequest,
  brevoApiKey: string | undefined,
  resendApiKey: string | undefined
) {
  const { project_id, action, rejection_reason } = body;

  // Get project details
  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, title, agency_id, client_id, assigned_to,
      clients(name),
      assigned_member:agency_members!projects_assigned_to_fkey(
        user_id,
        profile:profiles(full_name, email)
      )
    `)
    .eq("id", project_id)
    .single();

  if (!project) return new Response(JSON.stringify({ success: false }), { headers: corsHeaders });

  const notifType = action === 'approved' ? 'client_approved' : 'client_rejected';

  // Notify all agency owners/managers
  const { data: managers } = await supabase
    .from("agency_members")
    .select("user_id, profile:profiles(full_name, email)")
    .eq("agency_id", project.agency_id)
    .in("role", ["owner", "admin", "manager"]);

  for (const manager of managers || []) {
    await supabase.from("notifications").insert({
      agency_id: project.agency_id,
      user_type: "agency_member",
      user_id: manager.user_id,
      type: notifType,
      project_id: project_id,
      payload: {
        project_title: project.title,
        client_name: project.clients?.name,
        rejection_reason,
        message: action === 'approved' 
          ? `Client approved "${project.title}"` 
          : `Client requested changes on "${project.title}"`,
      },
    });

    // Send email for client actions
    const profile = Array.isArray(manager.profile) ? manager.profile[0] : manager.profile;
    if (profile?.email) {
      await sendEmail({
        to: profile.email,
        toName: profile.full_name || 'Team Member',
        subject: action === 'approved' 
          ? `✅ Client Approved: ${project.title}` 
          : `⚠️ Changes Requested: ${project.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${action === 'approved' ? '✅ Content Approved!' : '⚠️ Changes Requested'}</h2>
            <p>Client has ${action === 'approved' ? 'approved' : 'requested changes on'} "<strong>${project.title}</strong>".</p>
            ${rejection_reason ? `<p><strong>Feedback:</strong> ${rejection_reason}</p>` : ''}
          </div>
        `,
        brevoApiKey,
        resendApiKey,
      });
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleRawUpload(
  supabase: any,
  body: NotificationRequest,
  resendApiKey: string | undefined
) {
  const { asset_id, client_id, agency_id, uploader_id, title, content_type } = body;

  if (!client_id || !agency_id) {
    return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }

  // Get client details
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', client_id)
    .single();

  // Get uploader details
  const { data: uploader } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', uploader_id)
    .single();

  // Get all editors and managers
  const { data: members } = await supabase
    .from('agency_members')
    .select('user_id, role, profile:profiles(id, email, full_name)')
    .eq('agency_id', agency_id)
    .in('role', ['owner', 'admin', 'manager']);

  const uploaderName = uploader?.full_name || uploader?.email || 'A team member';

  for (const member of members || []) {
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
    const editorEmail = profile?.email;
    const editorName = profile?.full_name || 'there';

    if (!editorEmail) continue;

    // Create in-app notification
    await supabase.from("notifications").insert({
      agency_id: agency_id,
      user_type: "agency_member",
      user_id: member.user_id,
      type: "raw_upload",
      payload: {
        asset_id,
        client_name: client?.name,
        title,
        content_type,
        uploader_name: uploaderName,
        message: `New raw content "${title}" uploaded for ${client?.name}`,
      },
    });

    // Send email
    if (resendApiKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SMMAHUB <notifications@smmahub.net>',
            to: [editorEmail],
            subject: `New Raw Content: ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>New Raw Content Ready for Editing</h2>
                <p>Hi ${editorName},</p>
                <p><strong>${uploaderName}</strong> has uploaded new raw content:</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
                  <p style="margin: 5px 0;"><strong>Client:</strong> ${client?.name}</p>
                </div>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error(`Error sending email:`, emailError);
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true, notified_count: members?.length || 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function sendEmail(params: {
  to: string;
  toName: string;
  subject: string;
  html: string;
  brevoApiKey?: string;
  resendApiKey?: string;
}) {
  const { to, toName, subject, html, brevoApiKey, resendApiKey } = params;

  // Try Brevo first
  if (brevoApiKey) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "SMMAHUB", email: "notifications@smmahub.com" },
          to: [{ email: to, name: toName }],
          subject,
          htmlContent: html,
        }),
      });

      if (response.ok) {
        console.log("Email sent via Brevo");
        return true;
      }
    } catch (err) {
      console.error("Brevo error:", err);
    }
  }

  // Fall back to Resend
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SMMAHUB <notifications@smmahub.net>",
          to: [to],
          subject,
          html,
        }),
      });

      if (response.ok) {
        console.log("Email sent via Resend");
        return true;
      }
    } catch (err) {
      console.error("Resend error:", err);
    }
  }

  return false;
}
