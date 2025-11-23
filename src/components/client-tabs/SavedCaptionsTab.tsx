import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { FileText, Plus, Trash2, Copy } from "lucide-react";
import { format } from "date-fns";

interface SavedCaptionsTabProps {
  clientId: string;
}

interface SavedCaption {
  id: string;
  caption: string;
  created_at: string;
}

export default function SavedCaptionsTab({ clientId }: SavedCaptionsTabProps) {
  const { toast } = useToast();
  const { canCreateContent, canDeleteContent, isViewer } = useRole();
  const [captions, setCaptions] = useState<SavedCaption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewCaption, setViewCaption] = useState<SavedCaption | null>(null);
  const [deleteCaption, setDeleteCaption] = useState<SavedCaption | null>(null);
  const [newCaption, setNewCaption] = useState("");

  useEffect(() => {
    fetchCaptions();
  }, [clientId]);

  const fetchCaptions = async () => {
    const { data, error } = await supabase
      .from("client_saved_captions")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching captions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch saved captions",
        variant: "destructive",
      });
    } else {
      setCaptions(data || []);
    }
    setLoading(false);
  };

  const handleAddCaption = async () => {
    if (!newCaption.trim()) {
      toast({
        title: "Error",
        description: "Caption text is required",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("client_saved_captions")
      .insert({
        client_id: clientId,
        caption: newCaption.trim(),
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save caption",
        variant: "destructive",
      });
    } else {
      setCaptions([data, ...captions]);
      setNewCaption("");
      setIsAddOpen(false);
      toast({
        title: "Success",
        description: "Caption saved successfully",
      });
    }
  };

  const handleDeleteCaption = async () => {
    if (!deleteCaption) return;

    const { error } = await supabase
      .from("client_saved_captions")
      .delete()
      .eq("id", deleteCaption.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete caption",
        variant: "destructive",
      });
    } else {
      setCaptions(captions.filter((c) => c.id !== deleteCaption.id));
      setDeleteCaption(null);
      setViewCaption(null);
      toast({
        title: "Success",
        description: "Caption deleted successfully",
      });
    }
  };

  const handleCopyCaption = (caption: string) => {
    navigator.clipboard.writeText(caption);
    toast({
      title: "Copied",
      description: "Caption copied to clipboard",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">
          Loading captions...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Saved Captions</h2>
        </div>
        {canCreateContent && !isViewer && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Caption
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Saved Caption</DialogTitle>
              <DialogDescription>
                Save a caption template for future use
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="caption">Caption Text</Label>
                <Textarea
                  id="caption"
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="Write your caption here...&#10;&#10;You can include emojis, hashtags, and multiple paragraphs."
                  rows={12}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {newCaption.length} characters
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  setNewCaption("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddCaption}>Save Caption</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Captions List */}
      {isViewer && captions.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              You have read-only access to saved captions.
            </p>
          </CardContent>
        </Card>
      )}
      {captions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {captions.map((caption) => (
            <Card
              key={caption.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setViewCaption(caption)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {format(new Date(caption.created_at), "MMM d, yyyy")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCaption(caption.caption);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {caption.caption}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No saved captions yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Start building your caption template library
            </p>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Caption
            </Button>
          </CardContent>
        </Card>
      )}

      {/* View Caption Modal */}
      <Dialog open={!!viewCaption} onOpenChange={() => setViewCaption(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Saved Caption</DialogTitle>
          </DialogHeader>
          {viewCaption && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 max-h-[400px] overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{viewCaption.caption}</p>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Saved on {format(new Date(viewCaption.created_at), "PPP")}
                </span>
                <span>{viewCaption.caption.length} characters</span>
              </div>

              <div className="flex justify-between gap-2 pt-4 border-t">
                {canDeleteContent && (
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteCaption(viewCaption)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
                <Button
                  onClick={() => handleCopyCaption(viewCaption.caption)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCaption} onOpenChange={() => setDeleteCaption(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Caption</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this saved caption? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCaption}
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
