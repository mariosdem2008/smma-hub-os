import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientAuth } from "@/lib/client-auth";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FinalAsset {
  id: string;
  file_url: string;
  file_type: string;
  filename: string;
  final_caption: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  platforms: string[] | null;
  platform_captions: Record<string, string> | null;
  hashtags: string | null;
  notes: string | null;
  client_id: string;
  agency_id: string;
}

interface ProjectApprovalInterfaceProps {
  project: Project;
  finalAssets: FinalAsset[];
  onApprovalComplete: () => void;
}

export default function ProjectApprovalInterface({
  project,
  finalAssets,
  onApprovalComplete,
}: ProjectApprovalInterfaceProps) {
  const { toast } = useToast();
  const { clientUser } = useClientAuth();
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [clientNotes, setClientNotes] = useState<string>("");

  useEffect(() => {
    fetchClientNotes();
  }, [project.client_id]);

  const fetchClientNotes = async () => {
    const { data } = await supabase
      .from("clients")
      .select("notes")
      .eq("id", project.client_id)
      .single();

    if (data?.notes) {
      setClientNotes(data.notes);
    }
  };

  const handleApprove = async () => {
    if (!clientUser?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to approve content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Update project status to approved
      const { error: updateError } = await supabase
        .from("projects")
        .update({ status: "approved" })
        .eq("id", project.id);

      if (updateError) throw updateError;

      // Log activity
      const { error: activityError } = await supabase
        .from("project_activities")
        .insert({
          project_id: project.id,
          agency_id: project.agency_id,
          client_id: project.client_id,
          actor_type: "client",
          actor_id: clientUser.id,
          action: "approved",
          payload: {
            comment: comment.trim() || null,
            approved_at: new Date().toISOString(),
          },
        });

      if (activityError) throw activityError;

      // Send notification to agency
      await supabase.functions.invoke("send-approval-notification", {
        body: {
          project_id: project.id,
          action: "approved",
          comment: comment.trim() || null,
        },
      });

      toast({
        title: "Approved",
        description: "Content has been approved successfully",
      });

      onApprovalComplete();
    } catch (error: any) {
      console.error("Approval error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
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
        variant: "destructive",
      });
      return;
    }

    if (!comment.trim()) {
      toast({
        title: "Comment required",
        description: "Please provide feedback for requested changes",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Move project back to production stage
      const { error: updateError } = await supabase
        .from("projects")
        .update({ status: "production" })
        .eq("id", project.id);

      if (updateError) throw updateError;

      // Log activity
      const { error: activityError } = await supabase
        .from("project_activities")
        .insert({
          project_id: project.id,
          agency_id: project.agency_id,
          client_id: project.client_id,
          actor_type: "client",
          actor_id: clientUser.id,
          action: "changes_requested",
          payload: {
            comment: comment.trim(),
            requested_at: new Date().toISOString(),
          },
        });

      if (activityError) throw activityError;

      // Send notification to agency
      await supabase.functions.invoke("send-approval-notification", {
        body: {
          project_id: project.id,
          action: "changes_requested",
          comment: comment.trim(),
        },
      });

      toast({
        title: "Changes requested",
        description: "Your feedback has been sent to the team",
      });

      setShowChangesDialog(false);
      onApprovalComplete();
    } catch (error: any) {
      console.error("Request changes error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderAssetPreview = (asset: FinalAsset) => {
    if (asset.file_type.startsWith("image")) {
      return (
        <img
          src={asset.file_url}
          alt={asset.filename}
          className="w-full h-auto max-h-[400px] object-contain rounded-lg"
        />
      );
    }
    if (asset.file_type.startsWith("video")) {
      return (
        <video
          src={asset.file_url}
          controls
          className="w-full h-auto max-h-[400px] rounded-lg"
          playsInline
        />
      );
    }
    return (
      <p className="text-muted-foreground">
        Preview not available for this file type
      </p>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      <Card>
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="text-lg md:text-xl">Review Project</CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6 space-y-4 md:space-y-6">
          {/* Project Title */}
          <div>
            <Label className="text-sm font-semibold">Project Title</Label>
            <p className="mt-1 text-base md:text-lg font-medium">
              {project.title}
            </p>
          </div>

          {/* Final Content Preview */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Final Content</Label>
            {finalAssets.length === 0 ? (
              <div className="w-full h-48 bg-muted rounded flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  No final content available
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {finalAssets.map((asset) => (
                  <div key={asset.id} className="space-y-2">
                    <div className="rounded-lg overflow-hidden bg-muted">
                      {renderAssetPreview(asset)}
                    </div>
                    {asset.final_caption && (
                      <div className="text-sm text-muted-foreground">
                        <Label className="text-xs font-semibold">Caption</Label>
                        <p className="mt-1 whitespace-pre-wrap">
                          {asset.final_caption}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Project Details */}
          <div className="space-y-4">
            {project.description && (
              <div>
                <Label className="text-sm font-semibold">Description</Label>
                <p className="mt-1 text-sm md:text-base text-muted-foreground whitespace-pre-wrap">
                  {project.description}
                </p>
              </div>
            )}

            {project.platforms && project.platforms.length > 0 && (
              <div>
                <Label className="text-sm font-semibold">Platforms</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {project.platforms.map((platform) => (
                    <Badge key={platform} variant="secondary">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {project.platform_captions &&
              Object.keys(project.platform_captions).length > 0 && (
                <div>
                  <Label className="text-sm font-semibold">
                    Platform Captions
                  </Label>
                  <div className="space-y-2 mt-2">
                    {Object.entries(project.platform_captions).map(
                      ([platform, caption]) => (
                        <div
                          key={platform}
                          className="bg-muted p-3 rounded-lg space-y-1"
                        >
                          <Badge variant="outline" className="text-xs">
                            {platform}
                          </Badge>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {caption}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {project.hashtags && (
              <div>
                <Label className="text-sm font-semibold">Hashtags</Label>
                <p className="mt-1 text-sm md:text-base text-muted-foreground">
                  {project.hashtags}
                </p>
              </div>
            )}

            {project.notes && (
              <div>
                <Label className="text-sm font-semibold">Agency Notes</Label>
                <p className="mt-1 text-sm md:text-base text-muted-foreground whitespace-pre-wrap">
                  {project.notes}
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
                Your Feedback (Optional)
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
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {loading ? "Processing..." : "Approve Content"}
            </Button>
            <Button
              onClick={() => setShowChangesDialog(true)}
              disabled={loading}
              variant="destructive"
              className="flex-1 h-11"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Request Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Request Changes Dialog */}
      <AlertDialog open={showChangesDialog} onOpenChange={setShowChangesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide specific feedback on what needs to be changed. This
              will move the project back to production for the team to address.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="changes-comment" className="text-sm font-semibold">
              Required Feedback
            </Label>
            <Textarea
              id="changes-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe what changes are needed..."
              rows={4}
              className="mt-1.5"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestChanges}
              disabled={loading || !comment.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Feedback"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
