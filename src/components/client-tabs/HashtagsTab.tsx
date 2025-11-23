import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Hash, Plus, Upload, Trash2, Copy } from "lucide-react";

interface HashtagsTabProps {
  clientId: string;
}

interface Hashtag {
  id: string;
  tag: string;
  category: string | null;
  created_at: string;
}

export default function HashtagsTab({ clientId }: HashtagsTabProps) {
  const { toast } = useToast();
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [deleteHashtag, setDeleteHashtag] = useState<Hashtag | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [hashtagForm, setHashtagForm] = useState({
    tag: "",
    category: "",
  });
  const [bulkTags, setBulkTags] = useState("");

  useEffect(() => {
    fetchHashtags();
  }, [clientId]);

  const fetchHashtags = async () => {
    const { data, error } = await supabase
      .from("client_hashtags")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching hashtags:", error);
      toast({
        title: "Error",
        description: "Failed to fetch hashtags",
        variant: "destructive",
      });
    } else {
      setHashtags(data || []);
    }
    setLoading(false);
  };

  const normalizeTag = (tag: string) => {
    // Remove # if present and trim whitespace
    return tag.replace(/^#/, "").trim();
  };

  const handleAddHashtag = async () => {
    const normalizedTag = normalizeTag(hashtagForm.tag);
    
    if (!normalizedTag) {
      toast({
        title: "Error",
        description: "Tag is required",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("client_hashtags")
      .insert({
        client_id: clientId,
        tag: normalizedTag,
        category: hashtagForm.category.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add hashtag",
        variant: "destructive",
      });
    } else {
      setHashtags([data, ...hashtags]);
      setHashtagForm({ tag: "", category: "" });
      setIsAddOpen(false);
      toast({
        title: "Success",
        description: "Hashtag added successfully",
      });
    }
  };

  const handleBulkImport = async () => {
    if (!bulkTags.trim()) {
      toast({
        title: "Error",
        description: "Please enter hashtags to import",
        variant: "destructive",
      });
      return;
    }

    // Parse tags (support space, comma, and newline separated)
    const tags = bulkTags
      .split(/[\s,\n]+/)
      .map((tag) => normalizeTag(tag))
      .filter((tag) => tag.length > 0);

    if (tags.length === 0) {
      toast({
        title: "Error",
        description: "No valid hashtags found",
        variant: "destructive",
      });
      return;
    }

    // Remove duplicates
    const uniqueTags = [...new Set(tags)];

    // Insert all hashtags
    const { data, error } = await supabase
      .from("client_hashtags")
      .insert(
        uniqueTags.map((tag) => ({
          client_id: clientId,
          tag,
          category: null,
        }))
      )
      .select();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to import hashtags",
        variant: "destructive",
      });
    } else {
      setHashtags([...data, ...hashtags]);
      setBulkTags("");
      setIsBulkOpen(false);
      toast({
        title: "Success",
        description: `${uniqueTags.length} hashtag(s) imported successfully`,
      });
    }
  };

  const handleDeleteHashtag = async () => {
    if (!deleteHashtag) return;

    const { error } = await supabase
      .from("client_hashtags")
      .delete()
      .eq("id", deleteHashtag.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete hashtag",
        variant: "destructive",
      });
    } else {
      setHashtags(hashtags.filter((h) => h.id !== deleteHashtag.id));
      setDeleteHashtag(null);
      toast({
        title: "Success",
        description: "Hashtag deleted successfully",
      });
    }
  };

  const copyAllHashtags = () => {
    const tagsText = filteredHashtags.map((h) => `#${h.tag}`).join(" ");
    navigator.clipboard.writeText(tagsText);
    toast({
      title: "Success",
      description: `Copied ${filteredHashtags.length} hashtag(s) to clipboard`,
    });
  };

  const getUniqueCategories = () => {
    const categories = hashtags
      .map((h) => h.category)
      .filter((c) => c !== null) as string[];
    return [...new Set(categories)].sort();
  };

  const filteredHashtags = hashtags.filter((hashtag) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "uncategorized") return hashtag.category === null;
    return hashtag.category === categoryFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">
          Loading hashtags...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Hashtag Library</h2>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Import Hashtags</DialogTitle>
                <DialogDescription>
                  Paste multiple hashtags separated by spaces, commas, or new lines
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-tags">Hashtags</Label>
                  <Textarea
                    id="bulk-tags"
                    value={bulkTags}
                    onChange={(e) => setBulkTags(e.target.value)}
                    placeholder="#marketing #business #socialmedia&#10;#contentcreator #branding #entrepreneur"
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    The # symbol is optional and will be removed automatically
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsBulkOpen(false);
                    setBulkTags("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleBulkImport}>Import Hashtags</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Hashtag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Hashtag</DialogTitle>
                <DialogDescription>
                  Add a new hashtag to the library
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tag">Hashtag *</Label>
                  <Input
                    id="tag"
                    value={hashtagForm.tag}
                    onChange={(e) =>
                      setHashtagForm({ ...hashtagForm, tag: e.target.value })
                    }
                    placeholder="marketing (without #)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category (optional)</Label>
                  <Input
                    id="category"
                    value={hashtagForm.category}
                    onChange={(e) =>
                      setHashtagForm({ ...hashtagForm, category: e.target.value })
                    }
                    placeholder="e.g., General, Niche, Brand"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false);
                    setHashtagForm({ tag: "", category: "" });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddHashtag}>Add Hashtag</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Filter:</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="uncategorized">Uncategorized</SelectItem>
              {getUniqueCategories().map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filteredHashtags.length > 0 && (
          <Button variant="outline" size="sm" onClick={copyAllHashtags}>
            <Copy className="mr-2 h-4 w-4" />
            Copy All ({filteredHashtags.length})
          </Button>
        )}
      </div>

      {/* Hashtags Table */}
      {filteredHashtags.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hashtag</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHashtags.map((hashtag) => (
                  <TableRow key={hashtag.id}>
                    <TableCell className="font-mono">
                      #{hashtag.tag}
                    </TableCell>
                    <TableCell>
                      {hashtag.category ? (
                        <Badge variant="secondary">{hashtag.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Uncategorized
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`#${hashtag.tag}`);
                          toast({
                            title: "Copied",
                            description: `#${hashtag.tag} copied to clipboard`,
                          });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteHashtag(hashtag)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Hash className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              {categoryFilter === "all"
                ? "No hashtags yet"
                : "No hashtags in this category"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {categoryFilter === "all"
                ? "Add your first hashtag or bulk import multiple hashtags"
                : "Try selecting a different category"}
            </p>
            {categoryFilter === "all" && (
              <div className="flex gap-2">
                <Button onClick={() => setIsAddOpen(true)} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Hashtag
                </Button>
                <Button onClick={() => setIsBulkOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Import
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteHashtag} onOpenChange={() => setDeleteHashtag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Hashtag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "#{deleteHashtag?.tag}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHashtag}
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
