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
  title: string | null;
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
  custom_category: string | null;
}

interface Client {
  notes: string | null;
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
  const [title] = useState(asset.title || asset.filename || "");
  const [description, setDescription] = useState(asset.final_caption || "");
  const [clientNotes, setClientNotes] = useState<string>("");
  const [previousVersionUrl, setPreviousVersionUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchPreviousVersion();
    fetchClientNotes();
  }, [asset.id, clientId]);

  const fetchClientNotes = async () => {
    const { data } = await supabase
      .from('clients')
      .select('notes')
      .eq('id', clientId)
      .single();
    
    if (data?.notes) {
      setClientNotes(data.notes);
    }
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
      // Move to approved stage so agency can finalize before scheduling
      await supabase
        .from('assets')
        .update({ pipeline_stage: 'approved' })
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
      // Move asset back to in_production stage
      await supabase
        .from('assets')
        .update({ pipeline_stage: 'in_production' })
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
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      <Card>
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="text-lg md:text-xl">Review Content</CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-4 md:space-y-6">
          {/* Asset Preview */}
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="current">Current</TabsTrigger>
              {previousVersionUrl && (
                <TabsTrigger value="previous">Previous</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="current" className="mt-4">
              <div className="rounded-lg overflow-hidden bg-muted">
                {renderAssetPreview()}
              </div>
            </TabsContent>

            {previousVersionUrl && (
              <TabsContent value="previous" className="mt-4">
                <div className="rounded-lg overflow-hidden bg-muted">
                  {asset.file_type.startsWith('image') && (
                    <img src={previousVersionUrl} alt="Previous version" className="w-full h-auto" />
                  )}
                  {asset.file_type.startsWith('video') && (
                    <video src={previousVersionUrl} controls className="w-full h-auto" playsInline />
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <Separator />

          {/* Content Details */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">Title</Label>
              <p className="mt-1 text-sm md:text-base text-foreground">
                {title}
              </p>
            </div>

            {asset.content_type && (
              <div>
                <Label className="text-sm font-semibold">Content Type</Label>
                <p className="mt-1 text-sm md:text-base text-muted-foreground">
                  {asset.content_type.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </p>
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold">Description</Label>
              <p className="mt-1 text-sm md:text-base text-muted-foreground whitespace-pre-wrap">
                {description || "No description provided"}
              </p>
            </div>

            {asset.custom_category && (
              <div>
                <Label className="text-sm font-semibold">Notes</Label>
                <p className="mt-1 text-sm md:text-base text-muted-foreground whitespace-pre-wrap">
                  {asset.custom_category}
                </p>
              </div>
            )}

            {clientNotes && (
              <div>
                <Label className="text-sm font-semibold">Brand Notes</Label>
                <p className="mt-1 text-sm md:text-base text-muted-foreground whitespace-pre-wrap">
                  {clientNotes}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="comment" className="text-sm font-semibold">
                Your Feedback {comment.trim() ? "(Optional)" : "(Required for changes)"}
              </Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add your feedback or approval notes"
                rows={4}
                className="mt-1.5"
              />
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 h-11"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {loading ? "Processing..." : "Approve Content"}
            </Button>
            <Button
              onClick={handleRequestChanges}
              disabled={loading}
              variant="destructive"
              className="flex-1 h-11"
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
