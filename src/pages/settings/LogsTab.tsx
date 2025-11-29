import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface PostLog {
  id: string;
  project_id: string;
  platform: string;
  success: boolean;
  duration_ms: number;
  published_permalink: string;
  error_message: string;
  attempt_number: number;
  created_at: string;
  projects: {
    title: string;
    clients: {
      name: string;
    };
  };
}

interface TokenRefreshLog {
  id: string;
  social_connection_id: string;
  success: boolean;
  old_token_preview: string;
  new_token_preview: string;
  error_code: string;
  created_at: string;
  social_connections: {
    platform: string;
    account_name: string;
    clients: {
      name: string;
    };
  };
}

interface FailureTracking {
  id: string;
  consecutive_failures: number;
  last_failure_at: string;
  alert_sent: boolean;
  projects: {
    title: string;
    clients: {
      name: string;
    };
  };
}

export default function LogsTab() {
  const [postLogs, setPostLogs] = useState<PostLog[]>([]);
  const [tokenLogs, setTokenLogs] = useState<TokenRefreshLog[]>([]);
  const [failureTracking, setFailureTracking] = useState<FailureTracking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch post logs
      const { data: postData } = await supabase
        .from('post_logs')
        .select(`
          *,
          projects (
            title,
            clients (name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch token refresh logs
      const { data: tokenData } = await supabase
        .from('token_refresh_logs')
        .select(`
          *,
          social_connections (
            platform,
            account_name,
            clients (name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch failure tracking (only active failures)
      const { data: failureData } = await supabase
        .from('project_failure_tracking')
        .select(`
          *,
          projects (
            title,
            clients (name)
          )
        `)
        .gt('consecutive_failures', 0)
        .order('consecutive_failures', { ascending: false });

      setPostLogs(postData || []);
      setTokenLogs(tokenData || []);
      setFailureTracking(failureData || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">System Logs & Monitoring</h2>
        <p className="text-muted-foreground">
          Track autopost attempts, token refreshes, and system health
        </p>
      </div>

      {/* Failure Alerts */}
      {failureTracking.length > 0 && (
        <Card className="p-4 border-destructive">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Active Alerts</h3>
          </div>
          <div className="space-y-2">
            {failureTracking.map((tracking) => (
              <div key={tracking.id} className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                <div>
                  <p className="font-medium">
                    {tracking.projects.clients.name} - {tracking.projects.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tracking.consecutive_failures} consecutive failures
                  </p>
                </div>
                {tracking.alert_sent && (
                  <Badge variant="destructive">Alert Sent</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs defaultValue="autoposts" className="w-full">
        <TabsList>
          <TabsTrigger value="autoposts">Autopost Logs</TabsTrigger>
          <TabsTrigger value="tokens">Token Refresh</TabsTrigger>
        </TabsList>

        <TabsContent value="autoposts" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {postLogs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {log.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive mt-1" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {log.projects.clients.name} - {log.projects.title}
                          </p>
                          <Badge variant="outline">{log.platform}</Badge>
                          {log.duration_ms && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {log.duration_ms}ms
                            </span>
                          )}
                        </div>
                        {log.success && log.published_permalink && (
                          <a
                            href={log.published_permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {log.published_permalink}
                          </a>
                        )}
                        {!log.success && log.error_message && (
                          <p className="text-sm text-destructive">{log.error_message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), 'PPpp')} • Attempt #{log.attempt_number}
                        </p>
                      </div>
                    </div>
                    <Badge variant={log.success ? "default" : "destructive"}>
                      {log.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                </Card>
              ))}
              {postLogs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No autopost logs yet
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {tokenLogs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {log.success ? (
                        <RefreshCw className="h-5 w-5 text-green-500 mt-1" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive mt-1" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {log.social_connections.clients.name} - {log.social_connections.account_name}
                          </p>
                          <Badge variant="outline">{log.social_connections.platform}</Badge>
                        </div>
                        {log.success ? (
                          <div className="text-sm text-muted-foreground">
                            <p>Token refreshed successfully</p>
                            {log.old_token_preview && log.new_token_preview && (
                              <p className="text-xs mt-1">
                                {log.old_token_preview}... → {log.new_token_preview}...
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-destructive">
                            <p>Token refresh failed</p>
                            {log.error_code && (
                              <p className="text-xs mt-1">Error: {log.error_code}</p>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), 'PPpp')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={log.success ? "default" : "destructive"}>
                      {log.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                </Card>
              ))}
              {tokenLogs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No token refresh logs yet
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
