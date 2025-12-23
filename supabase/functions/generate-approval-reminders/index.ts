import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { verifyCronSecret } from "../_shared/cron.ts";

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const cronAuth = verifyCronSecret(req, headers);
  if (cronAuth) return cronAuth;

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find projects stuck in client_review for more than 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: stuckProjects, error: projectsError } = await supabaseClient
      .from('projects')
      .select(`
        id,
        title,
        agency_id,
        client_id,
        updated_at,
        clients(name)
      `)
      .eq('status', 'client_review')
      .lt('updated_at', fortyEightHoursAgo);

    if (projectsError) {
      console.error('Error fetching stuck projects:', projectsError);
      return new Response(JSON.stringify({ error: projectsError.message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (!stuckProjects || stuckProjects.length === 0) {
      return new Response(JSON.stringify({ message: 'No stuck projects found', notifications_created: 0 }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const notifications = [];

    for (const project of stuckProjects) {
      // Check if we already sent a reminder for this project in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: existingNotification } = await supabaseClient
        .from('notifications')
        .select('id')
        .eq('project_id', project.id)
        .eq('type', 'approval_reminder')
        .gt('created_at', twentyFourHoursAgo)
        .limit(1)
        .maybeSingle();

      if (existingNotification) continue;

      // Get agency owners/admins to notify
      const { data: agencyAdmins } = await supabaseClient
        .from('agency_members')
        .select('id')
        .eq('agency_id', project.agency_id)
        .in('role', ['owner', 'admin']);

      // Get client users to notify
      const { data: clientUsers } = await supabaseClient
        .from('client_users')
        .select('id')
        .eq('client_id', project.client_id);

      const clientName = (project.clients as any)?.name || 'Client';

      // Notify agency admins
      if (agencyAdmins) {
        for (const admin of agencyAdmins) {
          notifications.push({
            agency_id: project.agency_id,
            user_type: 'agency_member',
            user_id: admin.id,
            type: 'approval_reminder',
            project_id: project.id,
            payload: {
              project_title: project.title,
              client_name: clientName,
              message: `${clientName} has not reviewed "${project.title}" for over 48 hours`,
            },
          });
        }
      }

      // Notify client users
      if (clientUsers) {
        for (const clientUser of clientUsers) {
          notifications.push({
            agency_id: project.agency_id,
            user_type: 'client_user',
            user_id: clientUser.id,
            type: 'approval_reminder',
            project_id: project.id,
            payload: {
              project_title: project.title,
              message: `Please review pending content: "${project.title}"`,
            },
          });
        }
      }
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`Generated ${notifications.length} approval reminder notifications`);

    return new Response(JSON.stringify({ 
      message: 'Approval reminders generated',
      notifications_created: notifications.length,
    }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-approval-reminders:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
