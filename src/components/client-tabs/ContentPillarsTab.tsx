import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Columns3, Plus, Trash2 } from "lucide-react";

interface ContentPillarsTabProps {
  clientId: string;
}

interface Pillar {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export default function ContentPillarsTab({ clientId }: ContentPillarsTabProps) {
  const { toast } = useToast();
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewPillarOpen, setIsNewPillarOpen] = useState(false);
  const [isEditPillarOpen, setIsEditPillarOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [pillarForm, setPillarForm] = useState({
    title: "",
    description: "",
  });

  useEffect(() => {
    fetchPillars();
  }, [clientId]);

  const fetchPillars = async () => {
    const { data, error } = await supabase
      .from("client_content_pillars")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching pillars:", error);
      toast({
        title: "Error",
        description: "Failed to fetch content pillars",
        variant: "destructive",
      });
    } else {
      setPillars(data || []);
    }
    setLoading(false);
  };

  const handleAddPillar = async () => {
    if (!pillarForm.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("client_content_pillars")
      .insert({
        client_id: clientId,
        title: pillarForm.title.trim(),
        description: pillarForm.description.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create pillar",
        variant: "destructive",
      });
    } else {
      setPillars([...pillars, data]);
      setPillarForm({ title: "", description: "" });
      setIsNewPillarOpen(false);
      toast({
        title: "Success",
        description: "Content pillar created successfully",
      });
    }
  };

  const handleEditPillar = async () => {
    if (!selectedPillar || !pillarForm.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("client_content_pillars")
      .update({
        title: pillarForm.title.trim(),
        description: pillarForm.description.trim() || null,
      })
      .eq("id", selectedPillar.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update pillar",
        variant: "destructive",
      });
    } else {
      setPillars(
        pillars.map((p) =>
          p.id === selectedPillar.id
            ? {
                ...p,
                title: pillarForm.title.trim(),
                description: pillarForm.description.trim() || null,
              }
            : p
        )
      );
      setIsEditPillarOpen(false);
      setSelectedPillar(null);
      setPillarForm({ title: "", description: "" });
      toast({
        title: "Success",
        description: "Content pillar updated successfully",
      });
    }
  };

  const handleDeletePillar = async () => {
    if (!selectedPillar) return;

    const { error } = await supabase
      .from("client_content_pillars")
      .delete()
      .eq("id", selectedPillar.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete pillar",
        variant: "destructive",
      });
    } else {
      setPillars(pillars.filter((p) => p.id !== selectedPillar.id));
      setIsDeleteDialogOpen(false);
      setIsEditPillarOpen(false);
      setSelectedPillar(null);
      setPillarForm({ title: "", description: "" });
      toast({
        title: "Success",
        description: "Content pillar deleted successfully",
      });
    }
  };

  const openEditDialog = (pillar: Pillar) => {
    setSelectedPillar(pillar);
    setPillarForm({
      title: pillar.title,
      description: pillar.description || "",
    });
    setIsEditPillarOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">
          Loading content pillars...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Columns3 className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Content Pillars</h2>
        </div>
        <Dialog open={isNewPillarOpen} onOpenChange={setIsNewPillarOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Pillar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Content Pillar</DialogTitle>
              <DialogDescription>
                Define a key content theme for this client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-title">Title *</Label>
                <Input
                  id="new-title"
                  value={pillarForm.title}
                  onChange={(e) =>
                    setPillarForm({ ...pillarForm, title: e.target.value })
                  }
                  placeholder="e.g., Educational Content, Product Showcases"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-description">Description</Label>
                <Textarea
                  id="new-description"
                  value={pillarForm.description}
                  onChange={(e) =>
                    setPillarForm({ ...pillarForm, description: e.target.value })
                  }
                  placeholder="Describe this content pillar and its purpose..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsNewPillarOpen(false);
                  setPillarForm({ title: "", description: "" });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddPillar}>Create Pillar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pillars Grid */}
      {pillars.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <Card
              key={pillar.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => openEditDialog(pillar)}
            >
              <CardHeader>
                <CardTitle className="text-base">{pillar.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {pillar.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {pillar.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No description
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Columns3 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No content pillars yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first content pillar to organize your content strategy
            </p>
            <Button onClick={() => setIsNewPillarOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Pillar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditPillarOpen} onOpenChange={setIsEditPillarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Content Pillar</DialogTitle>
            <DialogDescription>
              Update the pillar details or delete it
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={pillarForm.title}
                onChange={(e) =>
                  setPillarForm({ ...pillarForm, title: e.target.value })
                }
                placeholder="e.g., Educational Content, Product Showcases"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={pillarForm.description}
                onChange={(e) =>
                  setPillarForm({ ...pillarForm, description: e.target.value })
                }
                placeholder="Describe this content pillar and its purpose..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditPillarOpen(false);
                  setSelectedPillar(null);
                  setPillarForm({ title: "", description: "" });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditPillar}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Pillar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedPillar?.title}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePillar}
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
