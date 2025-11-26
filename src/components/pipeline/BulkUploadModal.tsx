import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, File, Loader2, Image as ImageIcon, X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  agencyId: string;
  onSuccess: () => void;
}

interface Idea {
  id: string;
  title: string;
}

interface Script {
  id: string;
  title: string;
}

interface SelectedFile {
  file: File;
  preview?: string;
  id: string;
}

export default function BulkUploadModal({
  open,
  onOpenChange,
  clientId,
  agencyId,
  onSuccess,
}: BulkUploadModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    ideaId: "",
    scriptId: "",
    notes: "",
  });

  // Fetch ideas and scripts when modal opens
  useEffect(() => {
    if (open) {
      fetchIdeasAndScripts();
    }
  }, [open]);

  const fetchIdeasAndScripts = async () => {
    try {
      const [ideasRes, scriptsRes] = await Promise.all([
        supabase.from("ideas").select("id, title").eq("client_id", clientId).order("created_at", { ascending: false }),
        supabase.from("scripts").select("id, title").eq("client_id", clientId).order("created_at", { ascending: false }),
      ]);

      if (ideasRes.data) setIdeas(ideasRes.data);
      if (scriptsRes.data) setScripts(scriptsRes.data);
    } catch (error) {
      console.error("Error fetching ideas/scripts:", error);
    }
  };

  const handleLocalFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: SelectedFile[] = files.map(file => ({
      file,
      preview: file.type.startsWith("image/") || file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : undefined,
      id: Math.random().toString(36),
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnail(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Project title is required",
        variant: "destructive",
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one file to upload",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnail) {
        const thumbnailPath = `${clientId}/${Date.now()}_${thumbnail.name}`;
        const { data: thumbData, error: thumbError } = await supabase.storage
          .from("assets")
          .upload(thumbnailPath, thumbnail);

        if (thumbError) throw thumbError;
        const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(thumbnailPath);
        thumbnailUrl = publicUrl;
      }

      // 2. Create project record
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          client_id: clientId,
          agency_id: agencyId,
          title: formData.title,
          idea_id: formData.ideaId || null,
          script_id: formData.scriptId || null,
          notes: formData.notes || null,
          thumbnail_url: thumbnailUrl,
          pipeline_stage: "idea",
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 3. Upload all files and create asset records
      const uploadPromises = selectedFiles.map(async ({ file }) => {
        const filePath = `${clientId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("assets").upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(filePath);

        const fileType = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
          ? "video"
          : "document";

        // Create asset record
        const { data: asset, error: assetError } = await supabase
          .from("assets")
          .insert({
            client_id: clientId,
            project_id: project.id,
            filename: file.name,
            file_url: publicUrl,
            file_type: fileType,
            file_size: file.size,
            pipeline_stage: "idea",
          })
          .select()
          .single();

        if (assetError) throw assetError;

        // Link asset to project
        await supabase.from("project_assets").insert({
          project_id: project.id,
          asset_id: asset.id,
          display_order: 0,
        });

        return asset;
      });

      await Promise.all(uploadPromises);

      toast({
        title: "Project Created",
        description: `"${formData.title}" created with ${selectedFiles.length} assets`,
      });

      // Reset form
      setSelectedFiles([]);
      setThumbnail(null);
      setThumbnailPreview(null);
      setFormData({ title: "", ideaId: "", scriptId: "", notes: "" });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Q1 Campaign Video Series"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Link to Idea (Optional)</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.ideaId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, ideaId: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select idea" />
                    </SelectTrigger>
                    <SelectContent>
                      {ideas.map((idea) => (
                        <SelectItem key={idea.id} value={idea.id}>
                          {idea.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.ideaId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, ideaId: "" })}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Link to Script (Optional)</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.scriptId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, scriptId: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select script" />
                    </SelectTrigger>
                    <SelectContent>
                      {scripts.map((script) => (
                        <SelectItem key={script.id} value={script.id}>
                          {script.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.scriptId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, scriptId: "" })}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add project notes, instructions, or context..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Project Thumbnail (Optional)</Label>
              <div className="flex gap-4 items-start">
                {thumbnailPreview && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                    <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => {
                        setThumbnail(null);
                        setThumbnailPreview(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-sm">Upload Thumbnail</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleThumbnailSelect}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="space-y-4">
            <Label>Upload Assets *</Label>
            
            <Tabs defaultValue="local" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="local">Upload Files</TabsTrigger>
                <TabsTrigger value="existing">From Library</TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="space-y-4">
                <label className="cursor-pointer">
                  <div className="border-2 border-dashed rounded-lg p-8 hover:bg-accent transition-colors">
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <div className="text-center">
                        <p className="font-medium">Click to upload files</p>
                        <p className="text-sm text-muted-foreground">
                          Support for images, videos, and documents
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleLocalFileSelect}
                    accept="image/*,video/*,.pdf,.doc,.docx"
                  />
                </label>

                {selectedFiles.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedFiles.map((item) => (
                      <Card key={item.id} className="relative p-3">
                        {item.preview ? (
                          <div className="aspect-video rounded overflow-hidden bg-muted mb-2">
                            {item.file.type.startsWith("image/") ? (
                              <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover" />
                            ) : (
                              <video src={item.preview} className="w-full h-full object-cover" />
                            )}
                          </div>
                        ) : (
                          <div className="aspect-video rounded bg-muted flex items-center justify-center mb-2">
                            <File className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs truncate">{item.file.name}</p>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                          onClick={() => removeFile(item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="existing">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Select from existing client assets (Coming soon)</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
