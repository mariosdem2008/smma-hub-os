import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import CommentSection from "./CommentSection";

interface Post {
  id: string;
  title: string;
  content: string | null;
  platform: string | null;
  status: string;
  scheduled_for: string | null;
  created_at: string;
  asset_url?: string;
  asset_type?: string;
}

interface PostDetailModalProps {
  post: Post;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export default function PostDetailModal({ post, onClose, onCommentAdded }: PostDetailModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 gap-0">
        <div className="grid md:grid-cols-2 h-full">
          {/* Left: Asset Preview */}
          <div className="bg-black flex items-center justify-center">
            {post.asset_url ? (
              post.asset_type?.startsWith('image') ? (
                <img 
                  src={post.asset_url} 
                  alt={post.title}
                  className="max-w-full max-h-full object-contain"
                />
              ) : post.asset_type?.startsWith('video') ? (
                <video 
                  src={post.asset_url}
                  controls
                  className="max-w-full max-h-full"
                />
              ) : (
                <div className="text-white p-8">
                  <p>No preview available</p>
                </div>
              )
            ) : (
              <div className="text-white p-8">
                <p>No asset attached</p>
              </div>
            )}
          </div>

          {/* Right: Post Details & Comments */}
          <div className="flex flex-col h-full">
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="text-lg">{post.title}</DialogTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                {post.platform && (
                  <Badge variant="outline">{post.platform}</Badge>
                )}
                <Badge variant="secondary">{post.status}</Badge>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {post.content && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Content</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>
                )}

                {post.scheduled_for && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Scheduled for {format(new Date(post.scheduled_for), 'PPP')}</span>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className="h-5 w-5" />
                    <h4 className="font-semibold">Comments</h4>
                  </div>
                  
                  <CommentSection 
                    postId={post.id} 
                    onCommentAdded={onCommentAdded}
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
