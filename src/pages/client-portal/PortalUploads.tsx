import { useOutletContext } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileIcon, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useClientAuth } from "@/lib/client-auth";
import { UploadDropzone } from "@/components/shared/UploadDropzone";

const DEBUG_RELOAD = true;

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchUploads();
    if (DEBUG_RELOAD) console.log("[PortalUploads] subscribeToUploads mount for client", clientId);
    return subscribeToUploads();
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
    if (DEBUG_RELOAD) console.log("[PortalUploads] creating channel for client", clientId);
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
          if (DEBUG_RELOAD) console.log("[PortalUploads] change received, refetching uploads");
          fetchUploads();
        },
      )
      .subscribe();

    return () => {
      if (DEBUG_RELOAD) console.log("[PortalUploads] cleanup channel for client", clientId);
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
      const storedValue = localStorage.getItem(key);
      if (storedValue) {
        console.log(`Found value in localStorage key: ${key}`, storedValue.substring(0, 50) + "...");

        try {
          // Try to parse as JSON (might be a Supabase auth session object)
          const parsed = JSON.parse(storedValue);

          // Check if it's a Supabase auth session object
          if (parsed.access_token) {
            console.log(`Extracted access_token from JSON object`);
            return parsed.access_token;
          }

          // Check if it's a client portal token object
          if (parsed.token) {
            console.log(`Extracted token from JSON object`);
            return parsed.token;
          }

          // If it's a string that looks like a JWT (has 3 parts separated by dots)
          if (typeof parsed === "string" && parsed.split(".").length === 3) {
            console.log(`Value appears to be a JWT token`);
            return parsed;
          }
        } catch (e) {
          // Not JSON, check if it's a plain JWT token
          if (storedValue.split(".").length === 3) {
            console.log(`Value appears to be a plain JWT token`);
            return storedValue;
          }

          // Might be a JSON string that failed to parse
          console.log(`Could not parse value from key ${key} as JSON or JWT`);
        }
      }
    }

    // Check sessionStorage
    for (const key of possibleStorageKeys) {
      const storedValue = sessionStorage.getItem(key);
      if (storedValue) {
        console.log(`Found value in sessionStorage key: ${key}`, storedValue.substring(0, 50) + "...");

        try {
          const parsed = JSON.parse(storedValue);
          if (parsed.access_token) {
            console.log(`Extracted access_token from JSON object`);
            return parsed.access_token;
          }
          if (parsed.token) {
            console.log(`Extracted token from JSON object`);
            return parsed.token;
          }
          if (typeof parsed === "string" && parsed.split(".").length === 3) {
            return parsed;
          }
        } catch (e) {
          if (storedValue.split(".").length === 3) {
            return storedValue;
          }
        }
      }
    }

    // Check cookies
    try {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (possibleStorageKeys.includes(name)) {
          console.log(`Found value in cookie: ${name}`, value.substring(0, 50) + "...");

          try {
            const parsed = JSON.parse(value);
            if (parsed.access_token) return parsed.access_token;
            if (parsed.token) return parsed.token;
            if (typeof parsed === "string" && parsed.split(".").length === 3) return parsed;
          } catch (e) {
            if (value.split(".").length === 3) return value;
          }
        }
      }
    } catch (error) {
      console.error("Error reading cookies:", error);
    }

    console.log("No valid token found in any storage location");
    return null;
  };

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file || !clientUser) {
      setSelectedFiles([]);
      return;
    }

    setUploading(true);
    try {
      console.log("Starting file upload:", file.name, file.size, file.type);

      // Upload through Edge Function - cookies are sent automatically
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://dzyhrzdwwuaorruscxcn.supabase.co"}/functions/v1/upload-file`,
        {
          method: "POST",
          credentials: "include", // This sends HTTP-only cookies
          // NO Authorization header - cookies are sent automatically
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
      setSelectedFiles([]);
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
          <UploadDropzone
            files={selectedFiles}
            onFilesSelected={(files) => {
              setSelectedFiles(files);
              void handleFileUpload(files);
            }}
            uploading={uploading}
            accept="image/*,video/*,.pdf,.doc,.docx"
            browseLabel="Upload file"
            description="Drag & drop your file here, or click to browse"
            helperText="Max file size: 50MB. Allowed types: images, videos, PDFs, documents."
          />
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
