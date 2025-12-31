import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UploadDropzone } from "@/components/shared/UploadDropzone";

interface RawUploadZoneProps {
  clientId: string;
  agencyId: string;
  onUploadComplete: () => void;
}

const CONTENT_TYPES = [
  "educational",
  "promotional",
  "ugc",
  "reel",
  "story",
  "tutorial",
  "behind_the_scenes",
  "testimonial",
  "product_showcase",
  "announcement"
];

export default function RawUploadZone({ clientId, agencyId, onUploadComplete }: RawUploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [contentType, setContentType] = useState("educational");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    // Auto-generate title from filename if not set
    if (!title) {
      setTitle(file.name.split('.')[0].replace(/-|_/g, ' '));
    }
  };

  const detectFileType = (file: File): string => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.includes('document') || file.type.includes('word')) return 'document';
    return 'other';
  };

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a file and provide a title",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${clientId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(filePath);

      const fileType = detectFileType(selectedFile);

      // Create asset entry with pipeline_stage='idea'
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .insert({
          client_id: clientId,
          title: title || null,
          filename: selectedFile.name,
          file_url: publicUrl,
          file_type: fileType,
          file_size: selectedFile.size,
          uploaded_by: user.id,
          pipeline_stage: 'idea',
          content_type: contentType,
          final_caption: description || null,
          custom_category: notes || null,
          status: 'draft',
          visible_to_client: false,
          current_version: 1
        })
        .select()
        .single();

      if (assetError) throw assetError;

      // Create initial asset_version entry
      const { error: versionError } = await supabase
        .from('asset_versions')
        .insert({
          asset_id: asset.id,
          agency_id: agencyId,
          version_number: 1,
          file_url: publicUrl,
          file_size: selectedFile.size,
          uploaded_by: user.id
        });

      if (versionError) throw versionError;

      // Trigger notification to assigned editor
      try {
        await supabase.functions.invoke('notify-assigned-editor', {
          body: {
            asset_id: asset.id,
            client_id: clientId,
            agency_id: agencyId,
            uploader_id: user.id,
            title,
            content_type: contentType
          }
        });
      } catch (notifyError) {
        console.error("Notification error:", notifyError);
        // Don't fail upload if notification fails
      }

      toast({
        title: "Upload successful",
        description: "Raw asset uploaded and editors have been notified"
      });

      // Reset form
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      setNotes("");
      setContentType("educational");
      onUploadComplete();

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload asset",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Raw Content
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <UploadDropzone
          files={selectedFile ? [selectedFile] : []}
          onFilesSelected={handleFileSelect}
          onClearFiles={() => setSelectedFile(null)}
          uploading={uploading}
          accept="video/*,image/*,audio/*,.pdf,.doc,.docx"
          browseLabel="Select file"
          description="Drag & drop your file here, or click to browse"
          helperText={selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : undefined}
        />

        {/* Metadata Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter asset title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content-type">Content Type *</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger id="content-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.split('_').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the content"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes or instructions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || !title.trim() || uploading}
          className="w-full"
        >
          {uploading ? "Uploading..." : "Upload to Pipeline"}
        </Button>
      </CardContent>
    </Card>
  );
}
