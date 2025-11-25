import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientAuth } from "@/lib/client-auth";
import { CheckCircle, XCircle } from "lucide-react";

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
  pipeline_stage: string;
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
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [editedCaption, setEditedCaption] = useState(asset.final_caption || "");
  const [editedHashtags, setEditedHashtags] = useState(asset.hashtags || "");
  const [editedScheduledTime, setEditedScheduledTime] = useState(
    asset.scheduled_time ? new Date(asset.scheduled_time).toISOString().slice(0, 16) : ""
  );
  const [previousVersionUrl, setPreviousVersionUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchPreviousVersion();
  }, [asset.id]);

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

  const handleApprove = async () => {
    if (!clientUser?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to approve content",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
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

      // Add approval comment if provided
      if (comment.trim()) {
        await supabase
          .from('asset_comments')
          .insert({
            asset_id: asset.id,
            user_id: clientUser.id,
            comment: `✅ Client Approved: ${comment}`
          });
      }

      toast({
        title: "Approved",
        description: "Content has been approved successfully"
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
    if (!clientUser?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to request changes",
        variant: "destructive"
      });
      return;
    }

    if (!comment.trim()) {
      toast({
        title: "Comment required",
        description: "Please provide feedback for requested changes",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Move asset back to editing stage
      await supabase
        .from('assets')
        .update({ pipeline_stage: 'editing' })
        .eq('id', asset.id);

      // Add feedback comment
      await supabase
        .from('asset_comments')
        .insert({
          asset_id: asset.id,
          user_id: clientUser.id,
          comment: `🔄 Client Requested Changes: ${comment}`
        });

      toast({
        title: "Changes requested",
        description: "Your feedback has been sent to the team"
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

  const renderAssetPreview = () => {
    if (asset.file_type.startsWith('image')) {
      return <img src={asset.file_url} alt={asset.filename} className="w-full h-auto rounded-lg" />;
    }
    if (asset.file_type.startsWith('video')) {
      return (
        <video 
          src={asset.file_url} 
          controls 
          className="w-full h-auto rounded-lg"
          playsInline
        />
      );
    }
    return <p className="text-muted-foreground">Preview not available for this file type</p>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Content: {asset.filename}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="current" className="w-full">
            <TabsList>
              <TabsTrigger value="current">Current Version</TabsTrigger>
              {previousVersionUrl && (
                <TabsTrigger value="previous">Previous Version</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              <div className="mt-4">
                {renderAssetPreview()}
              </div>
            </TabsContent>

            {previousVersionUrl && (
              <TabsContent value="previous" className="space-y-4">
                <div className="mt-4">
                  {asset.file_type.startsWith('image') && (
                    <img src={previousVersionUrl} alt="Previous version" className="w-full h-auto rounded-lg" />
                  )}
                  {asset.file_type.startsWith('video') && (
                    <video src={previousVersionUrl} controls className="w-full h-auto rounded-lg" playsInline />
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div>
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={editedCaption}
                onChange={(e) => setEditedCaption(e.target.value)}
                placeholder="Edit caption if needed"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="hashtags">Hashtags</Label>
              <Input
                id="hashtags"
                value={editedHashtags}
                onChange={(e) => setEditedHashtags(e.target.value)}
                placeholder="#hashtag1 #hashtag2"
              />
            </div>

            <div>
              <Label htmlFor="scheduled">Scheduled Time</Label>
              <Input
                id="scheduled"
                type="datetime-local"
                value={editedScheduledTime}
                onChange={(e) => setEditedScheduledTime(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="comment">Your Feedback (Optional for approval, Required for changes)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add your feedback or approval notes"
                rows={3}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex gap-3">
            <Button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {loading ? "Processing..." : "Approve Content"}
            </Button>
            <Button
              onClick={handleRequestChanges}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {loading ? "Processing..." : "Request Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
