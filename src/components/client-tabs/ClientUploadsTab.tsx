import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { FileIcon, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface ClientUpload {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  status: string;
  uploaded_by: string;
  created_at: string;
  uploader?: {
    email: string;
    full_name: string | null;
  };
}

interface ClientUploadsTabProps {
  clientId: string;
  agencyId: string;
}

export default function ClientUploadsTab({ clientId, agencyId }: ClientUploadsTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploads, setUploads] = useState<ClientUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<ClientUpload | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUploads();
    subscribeToUploads();
  }, [clientId]);

  const fetchUploads = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("client_uploads")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (data) {
        setUploads(data as any);
      }
    } catch (error) {
      console.error("Error fetching uploads:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUploads = () => {
    const channel = supabase
      .channel("client_uploads_agency_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_uploads",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchUploads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleApprove = async (upload: ClientUpload) => {
    if (!user) return;

    setProcessing(true);
    try {
      // Move file to assets bucket
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("client-uploads")
        .download(upload.file_url.split("/client-uploads/")[1]);

      if (downloadError) throw downloadError;

      // Upload to assets bucket
      const fileName = `${clientId}/${Date.now()}_${upload.file_name}`;
      const { error: uploadError } = await supabase.storage
        .from("client-assets")
        .upload(fileName, fileData);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("client-assets")
        .getPublicUrl(fileName);

      // Create asset record
      const { error: assetError } = await supabase
        .from("assets")
        .insert({
          client_id: clientId,
          filename: upload.file_name,
          file_url: publicUrl,
          file_type: upload.file_type || "unknown",
          file_size: upload.file_size,
          uploaded_by: upload.uploaded_by,
          is_client_upload: true,
          visible_to_client: true,
          status: "approved",
        });

      if (assetError) throw assetError;

      // Update upload status
      const { error: updateError } = await supabase
        .from("client_uploads")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", upload.id);

      if (updateError) throw updateError;

      // Delete from client-uploads bucket
      await supabase.storage
        .from("client-uploads")
        .remove([upload.file_url.split("/client-uploads/")[1]]);

      toast({
        title: "Upload approved",
        description: "File has been moved to assets",
      });

      fetchUploads();
    } catch (error: any) {
      console.error("Approve error:", error);
      toast({
        title: "Approval failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user || !selectedUpload || !rejectionReason.trim()) return;

    setProcessing(true);
    try {
      // Update upload status
      const { error: updateError } = await supabase
        .from("client_uploads")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedUpload.id);

      if (updateError) throw updateError;

      // Delete from storage
      await supabase.storage
        .from("client-uploads")
        .remove([selectedUpload.file_url.split("/client-uploads/")[1]]);

      toast({
        title: "Upload rejected",
        description: "Client has been notified",
      });

      setShowRejectDialog(false);
      setSelectedUpload(null);
      setRejectionReason("");
      fetchUploads();
    } catch (error: any) {
      console.error("Reject error:", error);
      toast({
        title: "Rejection failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openRejectDialog = (upload: ClientUpload) => {
    setSelectedUpload(upload);
    setShowRejectDialog(true);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  const pendingUploads = uploads.filter((u) => u.status === "pending");
  const reviewedUploads = uploads.filter((u) => u.status !== "pending");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Review ({pendingUploads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading uploads...
            </div>
          ) : pendingUploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending uploads
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUploads.map((upload) => (
                <Card key={upload.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <FileIcon className="h-6 w-6" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{upload.file_name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary">Pending</Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatFileSize(upload.file_size)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Uploaded {format(new Date(upload.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(upload)}
                          disabled={processing}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(upload)}
                          disabled={processing}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {reviewedUploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reviewed Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reviewedUploads.map((upload) => (
                <Card key={upload.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <FileIcon className="h-6 w-6" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{upload.file_name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            variant={
                              upload.status === "approved" ? "default" : "destructive"
                            }
                          >
                            {upload.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(upload.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Upload</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this upload. The client will be
              notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Explain why this upload is being rejected..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectionReason.trim() || processing}
            >
              {processing ? "Processing..." : "Reject Upload"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
