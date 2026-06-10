import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Clock, Loader2, Globe, Trash2, Edit2, ExternalLink, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { convertToUTC, convertToLocal } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

interface ScheduledPostDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduledPostId: string | null;
  userTimezone: string;
  onSuccess?: () => void;
  readOnly?: boolean;
}

interface ScheduledPostDetail {
  id: string;
  project_id: string;
  platform: string;
  scheduled_for: string;
  status: string;
  caption: string | null;
  hashtags: string | null;
  error_message: string | null;
  platform_post_id: string | null;
  platform_permalink: string | null;
  published_at: string | null;
  retry_count: number;
  project: {
    title: string;
    description: string | null;
  };
  final_asset?: {
    file_url: string;
    file_type: string;
    filename: string;
  };
}

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case "instagram": return "📷";
    case "facebook": return "📘";
    case "linkedin": return "💼";
    default: return "🌐";
  }
};

const statusColors: Record<string, string> = {
  draft: "bg-slate-500",
  planned: "bg-indigo-500",
  pending: "bg-yellow-500",
  queued: "bg-blue-400",
  publishing: "bg-blue-600",
  published: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
};

export default function ScheduledPostDetailModal({
  open,
  onOpenChange,
  scheduledPostId,
  userTimezone,
  onSuccess,
  readOnly = false,
}: ScheduledPostDetailModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<ScheduledPostDetail | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Edit state
  const [editCaption, setEditCaption] = useState("");
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTime, setEditTime] = useState("");

  useEffect(() => {
    if (open && scheduledPostId) {
      fetchPostDetail();
    }
  }, [open, scheduledPostId]);

  const fetchPostDetail = async () => {
    if (!scheduledPostId) return;

    try {
      // Fetch scheduled post with project and asset details
      const { data: postData, error: postError } = await supabase
        .from("scheduled_posts")
        .select(`
          *,
          projects(title, description)
        `)
        .eq("id", scheduledPostId)
        .single();

      if (postError) throw postError;

      // Fetch final asset
      const { data: assetData } = await supabase
        .from("project_assets")
        .select("assets(file_url, file_type, filename)")
        .eq("project_id", postData.project_id)
        .eq("is_final_content", true)
        .single();

      const postDetail: ScheduledPostDetail = {
        ...postData,
        project: postData.projects as any,
        final_asset: assetData?.assets as any,
      };

      setPost(postDetail);
      
      // Initialize edit state
      setEditCaption(postDetail.caption || "");
      const localDate = convertToLocal(postDetail.scheduled_for, userTimezone);
      setEditDate(localDate);
      setEditTime(format(localDate, "HH:mm"));
    } catch (error: any) {
      console.error("Error fetching post:", error);
      toast({
        title: "Error",
        description: "Failed to load post details",
        variant: "destructive",
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!post || !editDate || !editTime) return;

    setLoading(true);
    try {
      // Convert local time to UTC
      const [hours, minutes] = editTime.split(":").map(Number);
      const localDateTime = new Date(editDate);
      localDateTime.setHours(hours, minutes, 0, 0);
      const utcDateTime = convertToUTC(localDateTime, userTimezone);

      const { error } = await supabase
        .from("scheduled_posts")
        .update({
          scheduled_for: utcDateTime,
          caption: editCaption || null,
        })
        .eq("id", post.id);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "Scheduled post updated successfully",
      });

      setIsEditing(false);
      onSuccess?.();
      fetchPostDetail();
    } catch (error: any) {
      toast({
        title: "Error saving changes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .update({ status: "cancelled" })
        .eq("id", post.id);

      if (error) throw error;

      toast({
        title: "Post cancelled",
        description: "The scheduled post has been cancelled",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error cancelling post",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  if (!post) {
    return null;
  }

  const localScheduledTime = convertToLocal(post.scheduled_for, userTimezone);
  const canEdit = !readOnly && ["draft", "planned", "pending", "queued"].includes(post.status);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getPlatformIcon(post.platform)}</span>
                <div>
                  <DialogTitle>{post.project.title}</DialogTitle>
                  <DialogDescription className="capitalize">
                    {post.platform} Post
                  </DialogDescription>
                </div>
              </div>
              <Badge className={cn("text-white", statusColors[post.status])}>
                {post.status}
              </Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 py-4">
              {/* Media Preview */}
              {post.final_asset && (
                <div className="rounded-lg overflow-hidden border">
                  {post.final_asset.file_type === "image" ? (
                    <img
                      src={post.final_asset.file_url}
                      alt={post.final_asset.filename}
                      className="w-full max-h-96 object-contain bg-muted"
                    />
                  ) : post.final_asset.file_type === "video" ? (
                    <video
                      src={post.final_asset.file_url}
                      controls
                      className="w-full max-h-96 object-contain bg-muted"
                    />
                  ) : null}
                </div>
              )}

              {/* Schedule Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Schedule</Label>
                  {canEdit && !isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>

                {isEditing && canEdit ? (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !editDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {editDate ? format(editDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={editDate}
                              onSelect={setEditDate}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Time ({userTimezone})</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-10 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    {editDate && editTime && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Local: {format(editDate, "MMM d, yyyy")} at {editTime} ({userTimezone})</p>
                        <p>UTC: {format(
                          parseISO(convertToUTC(
                            new Date(editDate.setHours(
                              parseInt(editTime.split(":")[0]),
                              parseInt(editTime.split(":")[1])
                            )),
                            userTimezone
                          )),
                          "MMM d, yyyy 'at' HH:mm"
                        )}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(localScheduledTime, "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        <Globe className="h-3 w-3 mr-1" />
                        {userTimezone}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      UTC: {format(parseISO(post.scheduled_for), "MMM d, yyyy 'at' HH:mm")}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Caption */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Caption</Label>
                {isEditing && canEdit ? (
                  <Textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    rows={6}
                    placeholder="Enter caption..."
                    className="resize-none"
                  />
                ) : (
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <p className="whitespace-pre-wrap text-sm">
                      {post.caption || <span className="text-muted-foreground italic">No caption</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Hashtags */}
              {post.hashtags && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Hashtags</Label>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-sm text-blue-600">{post.hashtags}</p>
                  </div>
                </div>
              )}

              {/* Published Info */}
              {post.status === "published" && post.platform_permalink && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Published</Label>
                  <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 space-y-2">
                    <p className="text-sm">
                      Published on {format(parseISO(post.published_at!), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    <a
                      href={post.platform_permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      View on {post.platform}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Error Info */}
              {post.status === "failed" && post.error_message && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Error</Label>
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm text-red-900 dark:text-red-100">
                          {post.error_message}
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          Retry attempts: {post.retry_count}/3
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-between">
            <div>
              {canEdit && !readOnly && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={loading}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Cancel Post
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditCaption(post.caption || "");
                      const localDate = convertToLocal(post.scheduled_for, userTimezone);
                      setEditDate(localDate);
                      setEditTime(format(localDate, "HH:mm"));
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveChanges} disabled={loading || !editDate || !editTime}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel scheduled post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the scheduled post and it will not be published. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, cancel post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
