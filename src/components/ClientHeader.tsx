import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { ExternalLink, Upload, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import ClientSearchBar from "./ClientSearchBar";

interface ClientHeaderProps {
  clientId: string;
  name: string;
  logoUrl: string | null;
  niche: string | null;
  website: string | null;
  primaryColor: string | null | undefined;
  compact?: boolean;
}

export default function ClientHeader({
  clientId,
  name,
  logoUrl,
  niche,
  website,
  primaryColor,
  compact = false,
}: ClientHeaderProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canCreateContent, role, canDeleteClients } = useRole();
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(logoUrl);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const filePath = `${clientId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("client-assets")
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("client-assets").getPublicUrl(filePath);

    const { error: dbError } = await supabase.from("assets").insert({
      client_id: clientId,
      file_url: data.publicUrl,
      filename: file.name,
      file_type: file.type,
      file_size: file.size,
    });

    if (dbError) {
      toast({
        title: "Error",
        description: "Failed to save asset",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Asset uploaded successfully",
      });
      setShowAssetDialog(false);
    }

    setUploading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setUploadingLogo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("client-logos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("client-logos").getPublicUrl(fileName);

      // Update client record
      const { error: updateError } = await supabase
        .from("clients")
        .update({ logo_url: publicUrl })
        .eq("id", clientId);

      if (updateError) throw updateError;

      setCurrentLogoUrl(publicUrl);
      toast({
        title: "Success",
        description: "Logo updated successfully",
      });
    } catch (error) {
      console.error("Logo upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_client_cascade", {
        p_client_id: clientId,
      });

      if (error) throw error;

      toast({
        title: "Client deleted",
        description: "The client and all related data were deleted.",
      });

      setShowDeleteDialog(false);
      navigate("/clients");
    } catch (error: any) {
      console.error("Delete client error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const canManageLogo = role === "owner" || role === "admin" || role === "manager";

  // Compact version for sidebar
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
          <AvatarImage src={currentLogoUrl || undefined} alt={name} />
          <AvatarFallback className="text-sm font-semibold bg-gradient-to-r from-[#4E5DFF] to-[#6A73FF] text-white">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{name}</h2>
          {niche && (
            <p className="text-xs text-muted-foreground truncate">{niche}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 rounded-xl border bg-card p-4 sm:p-6 shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
        <div className="relative">
          <input
            type="file"
            id="logo-upload"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={!canManageLogo || uploadingLogo}
          />
          <Avatar
            className={cn(
              "h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-[#4E5DFF]/20",
              canManageLogo && "cursor-pointer hover:ring-4 hover:ring-[#4E5DFF]/40 transition-all"
            )}
            onClick={() => {
              if (canManageLogo) {
                document.getElementById("logo-upload")?.click();
              }
            }}
          >
            <AvatarImage src={currentLogoUrl || undefined} alt={name} />
            <AvatarFallback className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-[#4E5DFF] to-[#6A73FF] text-white">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          {uploadingLogo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 w-full">
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#4E5DFF] to-[#6A73FF] bg-clip-text text-transparent">
              {name}
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="w-full sm:w-auto sm:flex-1">
                <ClientSearchBar clientId={clientId} />
              </div>
              {(canCreateContent || canDeleteClients) && (
                <div className="flex gap-2 flex-wrap">
                  {canCreateContent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAssetDialog(true)}
                      className="h-8 gap-2 flex-1 sm:flex-none transition-all duration-200"
                    >
                      <Upload className="h-4 w-4 icon-hover" />
                      <span className="sm:inline">Upload</span>
                    </Button>
                  )}
                  {canDeleteClients && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="h-8 gap-2 flex-1 sm:flex-none transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sm:inline">Delete Client</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {niche && (
              <Badge variant="secondary" className="text-xs sm:text-sm border border-[#4E5DFF]/20">
                {niche}
              </Badge>
            )}

            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs sm:text-sm text-[#4E5DFF] hover:text-[#6A73FF] transition-colors"
              >
                <span className="truncate max-w-[150px] sm:max-w-none">
                  {website.replace(/^https?:\/\//, "")}
                </span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            )}

            {primaryColor && (
              <Badge
                variant="outline"
                className="flex items-center gap-1.5 sm:gap-2 border-[#4E5DFF]/20"
              >
                <div
                  className="h-3 w-3 rounded-full ring-1 ring-white/20"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-xs font-mono hidden sm:inline">{primaryColor}</span>
              </Badge>
            )}
          </div>
        </div>
      </div>


      {/* Upload Asset Dialog */}
      <Dialog open={showAssetDialog} onOpenChange={setShowAssetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Asset</DialogTitle>
            <DialogDescription>Upload files to the asset library</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                accept="image/*,video/*,.pdf,.doc,.docx,.csv"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supported: Images, Videos, PDF, DOC, CSV
              </p>
            </div>

            {uploading && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssetDialog(false)}
              disabled={uploading}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete client</DialogTitle>
            <DialogDescription>
              This will permanently delete this client and all related data including
              assets, uploads, comments, and messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClient}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
