import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientAuth } from "@/lib/client-auth";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import ApprovalHistory from "./ApprovalHistory";

interface Asset {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  content_type: string | null;
  final_caption: string | null;
  hashtags: string | null;
  scheduled_time: string | null;
  platforms: string[] | null;
  current_version: number;
}

interface ApprovalTask {
  id: string;
  asset_version_id: string;
  approver_id: string;
  status: 'pending' | 'approved' | 'changes_requested';
  comments: any;
  created_at: string;
}

interface ClientApprovalInterfaceProps {
  asset: Asset;
  clientId: string;
  onApprovalComplete: () => void;
}

export default function ClientApprovalInterface({ 
  asset, 
  clientId,
  onApprovalComplete 
}: ClientApprovalInterfaceProps) {
  const { toast } = useToast();
  const { clientUser } = useClientAuth();
  const [loading, setLoading] = useState(true);
  const [currentTask, setCurrentTask] = useState<ApprovalTask | null>(null);
  const [comment, setComment] = useState("");
  const [editedCaption, setEditedCaption] = useState(asset.final_caption || "");
  const [editedHashtags, setEditedHashtags] = useState(asset.hashtags || "");
  const [editedScheduledTime, setEditedScheduledTime] = useState(
    asset.scheduled_time ? new Date(asset.scheduled_time).toISOString().slice(0, 16) : ""
  );
  const [previousVersionUrl, setPreviousVersionUrl] = useState<string | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCurrentApprovalTask();
    fetchPreviousVersion();
    fetchApprovalHistory();
  }, [asset.id, clientUser?.id]);

  const fetchCurrentApprovalTask = async () => {
    if (!clientUser?.id) return;

    try {
      setLoading(true);

      // Get latest version for this asset
      const { data: latestVersion } = await supabase
        .from('asset_versions')
        .select('id')
        .eq('asset_id', asset.id)
        .eq('version_number', asset.current_version)
        .single();

      if (!latestVersion) {
        setLoading(false);
        return;
      }

      // Get current approval task for this client user
      const { data: task } = await supabase
        .from('approval_tasks')
        .select('*')
        .eq('asset_version_id', latestVersion.id)
        .eq('approver_id', clientUser.id)
        .eq('status', 'pending')
        .maybeSingle();

      setCurrentTask(task);
    } catch (error: any) {
      console.error("Error fetching approval task:", error);
      toast({
        title: "Error",
        description: "Failed to load approval task",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviousVersion = async () => {
    if (asset.current_version <= 1) return;

    const { data: previousVersion } = await supabase
      .from('asset_versions')
      .select('file_url')
      .eq('asset_id', asset.id)
      .eq('version_number', asset.current_version - 1)
      .maybeSingle();

    if (previousVersion) {
      setPreviousVersionUrl(previousVersion.file_url);
    }
  };

  const fetchApprovalHistory = async () => {
    const { data: versions } = await supabase
      .from('asset_versions')
      .select(`
        id,
        version_number,
        created_at,
        approval_tasks (
          id,
          status,
          comments,
          created_at
        )
      `)
      .eq('asset_id', asset.id)
      .order('version_number', { ascending: false });

    setApprovalHistory(versions || []);
  };

  const handleApprove = async () => {
    if (!currentTask || !clientUser?.id) {
      toast({
        title: "Error",
        description: "No pending approval task found",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Update approval task
      const currentComments = Array.isArray(currentTask.comments) ? currentTask.comments : [];
      const { error: taskError } = await supabase
        .from('approval_tasks')
        .update({ 
          status: 'approved',
          comments: [...currentComments, {
            text: comment || "Approved",
            timestamp: new Date().toISOString(),
            action: 'approved',
            user_email: clientUser.email
          }]
        })
        .eq('id', currentTask.id);

      if (taskError) throw taskError;

      // Update asset metadata if edited
      const updates: any = {};
      if (editedCaption !== asset.final_caption) updates.final_caption = editedCaption;
      if (editedHashtags !== asset.hashtags) updates.hashtags = editedHashtags;
      if (editedScheduledTime) {
        updates.scheduled_time = new Date(editedScheduledTime).toISOString();
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('assets')
          .update(updates)
          .eq('id', asset.id);
      }

      // Single-step approval: move directly to scheduled stage
      await supabase
        .from('assets')
        .update({ pipeline_stage: 'scheduled' })
        .eq('id', asset.id);

      toast({
        title: "Approved",
        description: "Content has been approved successfully"
      });

      onApprovalComplete();
    } catch (error: any) {
      console.error("Approval error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve content",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!comment.trim()) {
      toast({
        title: "Comment required",
        description: "Please provide feedback for requested changes",
        variant: "destructive"
      });
      return;
    }

    if (!currentTask || !clientUser?.id) {
      toast({
        title: "Error",
        description: "No pending approval task found",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Update approval task
      const currentComments = Array.isArray(currentTask.comments) ? currentTask.comments : [];
      const { error: taskError } = await supabase
        .from('approval_tasks')
        .update({ 
          status: 'changes_requested',
          comments: [...currentComments, {
            text: comment,
            timestamp: new Date().toISOString(),
            action: 'changes_requested',
            user_email: clientUser.email
          }]
        })
        .eq('id', currentTask.id);

      if (taskError) throw taskError;

      // Move asset back to editing stage
      await supabase
        .from('assets')
        .update({ pipeline_stage: 'editing' })
        .eq('id', asset.id);

      // Notify editor/agency
      await supabase.functions.invoke('send-approval-notification', {
        body: {
          asset_id: asset.id,
          action: 'changes_requested',
          comment
        }
      });

      toast({
        title: "Changes requested",
        description: "The agency has been notified of your feedback"
      });

      onApprovalComplete();
    } catch (error: any) {
      console.error("Request changes error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to request changes",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentTask) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No pending approval task for you on this content
          </p>
        </CardContent>
      </Card>
    );
  }

  const canEditMetadata = clientUser?.role !== 'viewer';

  return (
    <div className="space-y-6">
      {/* Asset Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{asset.filename}</span>
            <Badge>
              Version {asset.current_version}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">Current Version</TabsTrigger>
              <TabsTrigger value="history">Approval History</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              {asset.file_type.startsWith('video/') ? (
                <video
                  src={asset.file_url}
                  controls
                  className="w-full max-h-[500px] rounded-lg bg-black"
                />
              ) : (
                <img
                  src={asset.file_url}
                  alt={asset.filename}
                  className="w-full max-h-[500px] object-contain rounded-lg"
                />
              )}
            </TabsContent>

            <TabsContent value="history">
              <ApprovalHistory history={approvalHistory} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Metadata Editing */}
      {canEditMetadata && (
        <Card>
          <CardHeader>
            <CardTitle>Content Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                placeholder="Enter caption..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hashtags">Hashtags</Label>
              <Input
                id="hashtags"
                value={editedHashtags}
                onChange={(e) => setEditedHashtags(e.target.value)}
                placeholder="#hashtag1 #hashtag2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled">Scheduled Time</Label>
              <Input
                id="scheduled"
                type="datetime-local"
                value={editedScheduledTime}
                onChange={(e) => setEditedScheduledTime(e.target.value)}
              />
            </div>

            {asset.platforms && asset.platforms.length > 0 && (
              <div className="space-y-2">
                <Label>Platforms</Label>
                <div className="flex gap-2 flex-wrap">
                  {asset.platforms.map(platform => (
                    <Badge key={platform} variant="secondary">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approval Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Your Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comment">Comment {!canEditMetadata && "(Optional)"}</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your feedback or comments..."
              rows={3}
            />
          </div>

          <Separator />

          <div className="flex gap-3">
            <Button
              onClick={handleApprove}
              disabled={submitting}
              className="flex-1"
              size="lg"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {submitting ? "Approving..." : "Approve"}
            </Button>

            <Button
              onClick={handleRequestChanges}
              disabled={submitting || !comment.trim()}
              variant="destructive"
              className="flex-1"
              size="lg"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {submitting ? "Submitting..." : "Request Changes"}
            </Button>
          </div>

          {!comment.trim() && (
            <p className="text-xs text-muted-foreground text-center">
              Comment is required for requesting changes
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
