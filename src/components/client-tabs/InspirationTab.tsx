import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { Sparkles, Plus, ExternalLink, Trash2, Upload, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";

interface InspirationTabProps {
  clientId: string;
}

interface Inspiration {
  id: string;
  image_url: string | null;
  source_url: string | null;
  description: string | null;
  created_at: string;
}

export default function InspirationTab({ clientId }: InspirationTabProps) {
  const { toast } = useToast();
  const { canCreateContent, canDeleteContent, isViewer } = useRole();
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [previewInspiration, setPreviewInspiration] = useState<Inspiration | null>(null);
  const [deleteInspiration, setDeleteInspiration] = useState<Inspiration | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<"upload" | "url">("upload");
  const [inspirationForm, setInspirationForm] = useState({
    image_url: "",
    source_url: "",
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchInspirations();
  }, [clientId]);

  const fetchInspirations = async () => {
    const { data, error } = await supabase
      .from("client_inspiration")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching inspirations:", error);
      toast({
        title: "Error",
        description: "Failed to fetch inspiration",
        variant: "destructive",
      });
    } else {
      setInspirations(data || []);
    }
    setLoading(false);
  };

  const handleAddInspiration = async () => {
    let imageUrl = inspirationForm.image_url;

    // If uploading a file
    if (uploadMethod === "upload" && selectedFile) {
      setUploading(true);
      try {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${clientId}/inspiration/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("client-assets")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("client-assets")
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Error",
          description: "Failed to upload image",
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    // Validate image URL
    if (!imageUrl || !imageUrl.trim()) {
      toast({
        title: "Error",
        description: "Image is required",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("client_inspiration")
      .insert({
        client_id: clientId,
        image_url: imageUrl.trim(),
        source_url: inspirationForm.source_url.trim() || null,
        description: inspirationForm.description.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add inspiration",
        variant: "destructive",
      });
    } else {
      setInspirations([data, ...inspirations]);
      setInspirationForm({ image_url: "", source_url: "", description: "" });
      setSelectedFile(null);
      setIsAddOpen(false);
      toast({
        title: "Success",
        description: "Inspiration added successfully",
      });
    }
  };

  const handleDeleteInspiration = async () => {
    if (!deleteInspiration) return;

    const { error } = await supabase
      .from("client_inspiration")
      .delete()
      .eq("id", deleteInspiration.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete inspiration",
        variant: "destructive",
      });
    } else {
      setInspirations(inspirations.filter((i) => i.id !== deleteInspiration.id));
      setDeleteInspiration(null);
      setPreviewInspiration(null);
      toast({
        title: "Success",
        description: "Inspiration deleted successfully",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Clear URL input when file is selected
      setInspirationForm({ ...inspirationForm, image_url: "" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">
          Loading inspiration...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Inspiration Board</h2>
        </div>
        {canCreateContent && !isViewer && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Inspiration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Inspiration</DialogTitle>
              <DialogDescription>
                Save reference content for this client's brand
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as "upload" | "url")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload Image</TabsTrigger>
                  <TabsTrigger value="url">Image URL</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image-file">Image File</Label>
                    <div className="border-2 border-dashed rounded-md p-6 text-center">
                      <input
                        type="file"
                        id="image-file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById("image-file")?.click()}
                        type="button"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Choose Image
                      </Button>
                      {selectedFile && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Selected: {selectedFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="url" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image-url">Image URL</Label>
                    <Input
                      id="image-url"
                      value={inspirationForm.image_url}
                      onChange={(e) =>
                        setInspirationForm({ ...inspirationForm, image_url: e.target.value })
                      }
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="source-url">Source URL (optional)</Label>
                <div className="flex gap-2">
                  <LinkIcon className="h-4 w-4 mt-3 text-muted-foreground" />
                  <Input
                    id="source-url"
                    value={inspirationForm.source_url}
                    onChange={(e) =>
                      setInspirationForm({ ...inspirationForm, source_url: e.target.value })
                    }
                    placeholder="https://pinterest.com/pin/..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={inspirationForm.description}
                  onChange={(e) =>
                    setInspirationForm({ ...inspirationForm, description: e.target.value })
                  }
                  placeholder="Describe what you like about this reference..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  setInspirationForm({ image_url: "", source_url: "", description: "" });
                  setSelectedFile(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddInspiration} disabled={uploading}>
                {uploading ? "Uploading..." : "Add Inspiration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Inspiration Grid */}
      {isViewer && inspirations.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              You have read-only access to inspiration.
            </p>
          </CardContent>
        </Card>
      )}
      {inspirations.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {inspirations.map((inspiration) => (
            <Card
              key={inspiration.id}
              className="cursor-pointer transition-shadow hover:shadow-md overflow-hidden group"
              onClick={() => setPreviewInspiration(inspiration)}
            >
              <div className="aspect-square overflow-hidden bg-muted">
                {inspiration.image_url ? (
                  <img
                    src={inspiration.image_url}
                    alt="Inspiration"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Sparkles className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              {(inspiration.source_url || inspiration.description) && (
                <CardContent className="p-3">
                  {inspiration.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {inspiration.description}
                    </p>
                  )}
                  {inspiration.source_url && (
                    <div className="flex items-center gap-1 mt-2">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate">
                        {new URL(inspiration.source_url).hostname}
                      </span>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No inspiration saved yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Start collecting reference content for this client
            </p>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Inspiration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewInspiration} onOpenChange={() => setPreviewInspiration(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Inspiration Details</DialogTitle>
          </DialogHeader>
          {previewInspiration && (
            <div className="space-y-4">
              {/* Image */}
              <div className="rounded-md bg-muted overflow-hidden">
                {previewInspiration.image_url && (
                  <img
                    src={previewInspiration.image_url}
                    alt="Inspiration"
                    className="w-full max-h-[500px] object-contain"
                  />
                )}
              </div>

              {/* Details */}
              <div className="space-y-3">
                {previewInspiration.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {previewInspiration.description}
                    </p>
                  </div>
                )}

                {previewInspiration.source_url && (
                  <div>
                    <Label className="text-sm font-medium">Source</Label>
                    <a
                      href={previewInspiration.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {previewInspiration.source_url}
                    </a>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Added</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(previewInspiration.created_at), "PPP")}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {canDeleteContent && (
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteInspiration(previewInspiration)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteInspiration} onOpenChange={() => setDeleteInspiration(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inspiration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inspiration? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInspiration}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
