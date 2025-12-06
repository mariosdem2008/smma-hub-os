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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { ExternalLink, Upload, Trash2, Edit, Check, X, Camera } from "lucide-react";
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
  onClientUpdate?: () => void;
}

export default function ClientHeader({
  clientId,
  name,
  logoUrl,
  niche,
  website,
  primaryColor,
  compact = false,
  onClientUpdate,
}: ClientHeaderProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canCreateContent, role, canDeleteClients } = useRole();
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(logoUrl);
  const [editForm, setEditForm] = useState({
    name: name,
    niche: niche || "",
    website: website || "",
    primaryColor: primaryColor || "",
  });

  const canManageClient = role === "owner" || role === "admin" || role === "manager";

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

    const { error: uploadError } = await supabase.storage.from("client-assets").upload(filePath, file);

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
      const { error: uploadError } = await supabase.storage.from("client-logos").upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("client-logos").getPublicUrl(fileName);

      // Update client record
      const { error: updateError } = await supabase.from("clients").update({ logo_url: publicUrl }).eq("id", clientId);

      if (updateError) throw updateError;

      setCurrentLogoUrl(publicUrl);
      toast({
        title: "Success",
        description: "Logo updated successfully",
      });

      // Trigger parent update if callback provided
      if (onClientUpdate) {
        onClientUpdate();
      }
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

  const handleSaveChanges = async () => {
    if (!editForm.name.trim()) {
      toast({
        title: "Error",
        description: "Client name is required",
        variant: "destructive",
      });
      return;
    }

    setSavingChanges(true);

    try {
      const updates = {
        name: editForm.name.trim(),
        niche: editForm.niche.trim() || null,
        website: editForm.website.trim() || null,
        primary_color: editForm.primaryColor.trim() || null,
      };

      const { error } = await supabase.from("clients").update(updates).eq("id", clientId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client details updated successfully",
      });

      setShowEditDialog(false);

      // Trigger parent update
      if (onClientUpdate) {
        onClientUpdate();
      }
    } catch (error) {
      console.error("Update client error:", error);
      toast({
        title: "Error",
        description: "Failed to update client details",
        variant: "destructive",
      });
    } finally {
      setSavingChanges(false);
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

  // Compact version for sidebar
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="file"
            id="logo-upload-compact"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={!canManageClient || uploadingLogo}
          />
          <Avatar
            className={cn(
              "h-10 w-10 ring-2 ring-primary/20",
              canManageClient && "cursor-pointer hover:ring-4 hover:ring-primary/40 transition-all",
            )}
            onClick={() => {
              if (canManageClient) {
                setShowEditDialog(true);
              }
            }}
          >
            <AvatarImage src={currentLogoUrl || undefined} alt={name} />
            <AvatarFallback className="text-sm font-semibold bg-gradient-to-r from-[#4E5DFF] to-[#6A73FF] text-white">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          {uploadingLogo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{name}</h2>
          {niche && <p className="text-xs text-muted-foreground truncate">{niche}</p>}
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
            disabled={!canManageClient || uploadingLogo}
          />
          <Avatar
            className={cn(
              "h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-[#4E5DFF]/20",
              canManageClient && "cursor-pointer hover:ring-4 hover:ring-[#4E5DFF]/40 transition-all",
            )}
            onClick={() => {
              if (canManageClient) {
                setShowEditDialog(true);
              }
            }}
          >
            <AvatarImage src={currentLogoUrl || undefined} alt={name} />
            <AvatarFallback className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-[#4E5DFF] to-[#6A73FF] text-white">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          {canManageClient && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                document.getElementById("logo-upload")?.click();
              }}
              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors border-2 border-background"
              title="Upload new logo"
            >
              <Camera className="h-3 w-3 text-white" />
            </button>
          )}
          {uploadingLogo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 w-full">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#4E5DFF] to-[#6A73FF] bg-clip-text text-transparent">
                {name}
              </h1>
            </div>

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
                <span className="truncate max-w-[150px] sm:max-w-none">{website.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            )}

            {primaryColor && (
              <Badge variant="outline" className="flex items-center gap-1.5 sm:gap-2 border-[#4E5DFF]/20">
                <div className="h-3 w-3 rounded-full ring-1 ring-white/20" style={{ backgroundColor: primaryColor }} />
                <span className="text-xs font-mono hidden sm:inline">{primaryColor}</span>
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Client Details</DialogTitle>
            <DialogDescription>Update client information. Changes will be saved immediately.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name *</Label>
              <Input
                id="client-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Enter client name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-niche">Niche/Industry</Label>
              <Input
                id="client-niche"
                value={editForm.niche}
                onChange={(e) => setEditForm({ ...editForm, niche: e.target.value })}
                placeholder="e.g., Technology, Fashion, Healthcare"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-website">Website</Label>
              <Input
                id="client-website"
                type="url"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color (Hex)</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  value={editForm.primaryColor}
                  onChange={(e) => setEditForm({ ...editForm, primaryColor: e.target.value })}
                  placeholder="#4E5DFF"
                  className="flex-1"
                />
                <div
                  className="h-10 w-10 rounded-md border"
                  style={{ backgroundColor: editForm.primaryColor || "#4E5DFF" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Enter a hex color code (e.g., #4E5DFF)</p>
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={currentLogoUrl || undefined} alt={name} />
                  <AvatarFallback>{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div>
                  <input
                    type="file"
                    id="edit-logo-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("edit-logo-upload")?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? "Uploading..." : "Change Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">Click this button to upload a new logo image</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={savingChanges}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} disabled={savingChanges || !editForm.name.trim()}>
              {savingChanges ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <p className="text-xs text-muted-foreground mt-2">Supported: Images, Videos, PDF, DOC, CSV</p>
            </div>

            {uploading && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssetDialog(false)} disabled={uploading}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the client and all associated data including
              assets, uploads, comments, and messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
