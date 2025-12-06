import { useOutletContext } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileIcon, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useClientAuth } from "@/lib/client-auth";

interface ClientUpload {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

export default function PortalUploads() {
  const { clientId } = useOutletContext<{ clientId: string; client: any }>();
  const { clientUser } = useClientAuth();
  const { toast } = useToast();
  const [uploads, setUploads] = useState<ClientUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
        .eq("uploaded_by", clientUser?.id || "")
        .order("created_at", { ascending: false });

      if (data) {
        setUploads(data);
      }
    } catch (error) {
      console.error("Error fetching uploads:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUploads = () => {
    const channel = supabase
      .channel("client_uploads_changes")
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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getClientPortalToken = (): string | null => {
    console.log("Looking for client portal token...");

    // First, check if there's a token in the URL (for invite flows)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");
    if (tokenFromUrl) {
      console.log("Found token in URL");
      return tokenFromUrl;
    }

    // Check localStorage for various possible token names
    const possibleStorageKeys = [
      "cp_access_token",
      "client_portal_token",
      "sb-access-token",
      "sb-dzyhrzdwwuaorruscxcn-auth-token",
      "access_token",
      "token",
    ];

    for (const key of possibleStorageKeys) {
      const token = localStorage.getItem(key);
      if (token) {
        console.log(`Found token in localStorage key: ${key}`);
        return token;
      }
    }

    // Check sessionStorage
    for (const key of possibleStorageKeys) {
      const token = sessionStorage.getItem(key);
      if (token) {
        console.log(`Found token in sessionStorage key: ${key}`);
        return token;
      }
    }

    // Check cookies
    try {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (possibleStorageKeys.includes(name)) {
          console.log(`Found token in cookie: ${name}`);
          return value;
        }
      }
    } catch (error) {
      console.error("Error reading cookies:", error);
    }

    // Last resort: Check if useClientAuth provides a token
    // We can't access it directly, but we can check if clientUser has any token info
    console.log("clientUser object:", clientUser);

    // If clientUser exists but we can't find a token, the auth system might not expose it
    // We need to look at how useConversations.ts gets the token
    console.log("No token found in any storage location");
    return null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !clientUser) return;

    setUploading(true);
    try {
      console.log("Starting file upload:", file.name, file.size, file.type);

      // Get the client portal token
      const token = getClientPortalToken();

      if (!token) {
        // If no token found, check if we should use the client auth system differently
        console.log("No token found. Checking auth method...");

        // Try a different approach: Maybe the auth is handled by cookies automatically
        // Let's try uploading without Authorization header but with credentials
        console.log("Attempting upload with credentials only...");

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || "https://dzyhrzdwwuaorruscxcn.supabase.co"}/functions/v1/upload-file`,
          {
            method: "POST",
            credentials: "include", // Send cookies
            body: formData,
          },
        );

        if (!response.ok) {
          // If that fails, try with debug parameter to get more info
          const debugResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || "https://dzyhrzdwwuaorruscxcn.supabase.co"}/functions/v1/upload-file?debug=true`,
            {
              method: "POST",
              credentials: "include",
              body: formData,
            },
          );

          if (debugResponse.ok) {
            const debugData = await debugResponse.json();
            console.log("Debug response:", debugData);
            throw new Error("Authentication issue. Debug info: " + JSON.stringify(debugData.debug));
          }

          const errorText = await response.text();
          throw new Error(errorText || "Upload failed - no authentication token found");
        }

        const result = await response.json();
        console.log("Upload successful (with credentials):", result);

        toast({
          title: "File uploaded successfully",
          description: "Your file is pending review by the agency team",
        });

        fetchUploads();
        return;
      }

      console.log("Using token for upload:", token.substring(0, 20) + "...");

      // Upload through Edge Function with token in Authorization header
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://dzyhrzdwwuaorruscxcn.supabase.co"}/functions/v1/upload-file`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      console.log("Upload response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload error response:", errorText);
        let errorMessage = "Upload failed";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Upload successful:", result);

      toast({
        title: "File uploaded successfully",
        description: "Your file is pending review by the agency team",
      });

      fetchUploads();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "approved":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return <FileIcon className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Uploads</h1>
        <p className="text-muted-foreground mt-1">Upload files for agency review</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload New File</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">Click to upload or drag and drop files here</p>
            <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            <Button asChild disabled={uploading}>
              <label htmlFor="file-upload" className="cursor-pointer">
                {uploading ? "Uploading..." : "Choose File"}
              </label>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Max file size: 50MB. Allowed types: images, videos, PDFs, documents
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading uploads...</div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No uploads yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uploads.map((upload) => (
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
                          <Badge variant={getStatusBadge(upload.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(upload.status)}
                              {upload.status}
                            </span>
                          </Badge>
                          <span className="text-sm text-muted-foreground">{formatFileSize(upload.file_size)}</span>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(upload.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                        {upload.rejection_reason && (
                          <p className="text-sm text-destructive mt-2">Rejection reason: {upload.rejection_reason}</p>
                        )}
                        {upload.file_url && (
                          <div className="mt-2">
                            <a
                              href={upload.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline"
                            >
                              View file
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
