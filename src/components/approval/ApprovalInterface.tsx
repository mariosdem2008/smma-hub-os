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
import { CheckCircle, XCircle, Clock } from "lucide-react";
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

interface ApprovalInterfaceProps {
  asset: Asset;
  clientId: string;
  onApprovalComplete: () => void;
}

export default function ApprovalInterface({ 
  asset, 
  clientId,
  onApprovalComplete 
}: ApprovalInterfaceProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState<ApprovalTask | null>(null);
  const [comment, setComment] = useState("");
  const [editedCaption, setEditedCaption] = useState(asset.final_caption || "");
  const [editedHashtags, setEditedHashtags] = useState(asset.hashtags || "");
  const [editedScheduledTime, setEditedScheduledTime] = useState(
    asset.scheduled_time ? new Date(asset.scheduled_time).toISOString().slice(0, 16) : ""
  );
  const [previousVersionUrl, setPreviousVersionUrl] = useState<string | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchCurrentApprovalTask();
    fetchPreviousVersion();
    fetchApprovalHistory();
  }, [asset.id]);

  const fetchCurrentApprovalTask = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get latest version for this asset
    const { data: latestVersion } = await supabase
      .from('asset_versions')
      .select('id')
      .eq('asset_id', asset.id)
      .eq('version_number', asset.current_version)
      .single();

    if (!latestVersion) return;

    // Get current approval task
    const { data: task } = await supabase
      .from('approval_tasks')
      .select('*')
      .eq('asset_version_id', latestVersion.id)
      .eq('approver_id', user.id)
      .eq('status', 'pending')
      .single();

    setCurrentTask(task);
  };

  const fetchPreviousVersion = async () => {
    if (asset.current_version <= 1) return;

    const { data: previousVersion } = await supabase
      .from('asset_versions')
      .select('file_url')
      .eq('asset_id', asset.id)
      .eq('version_number', asset.current_version - 1)
      .single();

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
          created_at,
          profiles:approver_id (email, full_name)
        )
      `)
      .eq('asset_id', asset.id)
      .order('version_number', { ascending: false });

    setApprovalHistory(versions || []);
  };

  const handleApprove = async () => {
    if (!currentTask) {
      toast({
        title: "Error",
        description: "No pending approval task found",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

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
            action: 'approved'
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
        description: "Asset has been approved successfully"
      });

      onApprovalComplete();
    } catch (error: any) {
      console.error("Approval error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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

    if (!currentTask) {
      toast({
        title: "Error",
        description: "No pending approval task found",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

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
            action: 'changes_requested'
          }]
        })
        .eq('id', currentTask.id);

      if (taskError) throw taskError;

      // Move asset back to editing stage
      await supabase
        .from('assets')
        .update({ pipeline_stage: 'editing' })
        .eq('id', asset.id);

      // Notify editor
      await supabase.functions.invoke('send-approval-notification', {
        body: {
          asset_id: asset.id,
          action: 'changes_requested',
          comment
        }
      });

      toast({
        title: "Changes requested",
        description: "Editor has been notified"
      });

      onApprovalComplete();
    } catch (error: any) {
      console.error("Request changes error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!currentTask) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No pending approval task for you on this asset
          </p>
        </CardContent>
      </Card>
    );
  }

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
                  className="w-full max-h-[500px] rounded-lg"
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
              <div className="flex gap-2">
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

      {/* Approval Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Your Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comment">Comment</Label>
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
              disabled={loading}
              className="flex-1"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>

            <Button
              onClick={handleRequestChanges}
              disabled={loading || !comment.trim()}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Request Changes
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
