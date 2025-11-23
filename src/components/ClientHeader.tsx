import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { ExternalLink, FileText, Upload } from "lucide-react";
import ClientSearchBar from "./ClientSearchBar";

interface ClientHeaderProps {
  clientId: string;
  name: string;
  logoUrl: string | null;
  niche: string | null;
  website: string | null;
  primaryColor: string | null | undefined;
}

export default function ClientHeader({
  clientId,
  name,
  logoUrl,
  niche,
  website,
  primaryColor,
}: ClientHeaderProps) {
  const { toast } = useToast();
  const { canCreateContent } = useRole();
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [postForm, setPostForm] = useState({
    title: "",
    platform: "",
    content: "",
    scheduled_for: "",
    status: "draft",
  });
  const [uploading, setUploading] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCreatePost = async () => {
    if (!postForm.title || !postForm.platform) {
      toast({
        title: "Missing fields",
        description: "Title and platform are required",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("posts").insert({
      client_id: clientId,
      title: postForm.title,
      platform: postForm.platform,
      content: postForm.content,
      scheduled_for: postForm.scheduled_for || null,
      status: postForm.status,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Post created successfully",
      });
      setShowPostDialog(false);
      setPostForm({
        title: "",
        platform: "",
        content: "",
        scheduled_for: "",
        status: "draft",
      });
    }
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

  return (
    <>
      <div className="flex items-start gap-6 rounded-lg border bg-card p-6">
        <Avatar className="h-20 w-20">
          <AvatarImage src={logoUrl || undefined} alt={name} />
          <AvatarFallback className="text-2xl font-semibold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">{name}</h1>
            <div className="flex flex-col items-end gap-2">
              <ClientSearchBar clientId={clientId} />
              {canCreateContent && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPostDialog(true)}
                    className="h-8 gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    New Post
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAssetDialog(true)}
                    className="h-8 gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Asset
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {niche && (
              <Badge variant="secondary" className="text-sm">
                {niche}
              </Badge>
            )}

            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {website.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {primaryColor && (
              <Badge
                variant="outline"
                className="flex items-center gap-2"
                style={{ borderColor: primaryColor }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-xs">{primaryColor}</span>
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* New Post Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={postForm.title}
                onChange={(e) =>
                  setPostForm({ ...postForm, title: e.target.value })
                }
                placeholder="Post title"
              />
            </div>

            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={postForm.platform}
                onValueChange={(value) =>
                  setPostForm({ ...postForm, platform: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="YouTube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={postForm.content}
                onChange={(e) =>
                  setPostForm({ ...postForm, content: e.target.value })
                }
                placeholder="Post content"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="scheduled_for">Scheduled Date</Label>
              <Input
                id="scheduled_for"
                type="datetime-local"
                value={postForm.scheduled_for}
                onChange={(e) =>
                  setPostForm({ ...postForm, scheduled_for: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPostDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreatePost}>Create Post</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Asset Dialog */}
      <Dialog open={showAssetDialog} onOpenChange={setShowAssetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Asset</DialogTitle>
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
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowAssetDialog(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
