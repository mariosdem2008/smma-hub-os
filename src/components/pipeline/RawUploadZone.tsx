import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [contentType, setContentType] = useState("educational");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFile(files[0]);
      // Auto-generate title from filename if not set
      if (!title) {
        setTitle(files[0].name.split('.')[0].replace(/-|_/g, ' '));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      // Auto-generate title from filename if not set
      if (!title) {
        setTitle(files[0].name.split('.')[0].replace(/-|_/g, ' '));
      }
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
          filename: title,
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
        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
        >
          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <span className="font-medium">{selectedFile.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop your file here, or click to browse
              </p>
              <Input
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                accept="video/*,image/*,audio/*,.pdf,.doc,.docx"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Select File
              </Button>
            </div>
          )}
        </div>

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
