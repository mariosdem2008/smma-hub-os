import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileImage, FileVideo, FileText, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PostDetailModal from "./PostDetailModal";

interface PostsGridProps {
  clientId: string;
}

interface Post {
  id: string;
  title: string;
  content: string | null;
  platform: string | null;
  status: string;
  scheduled_for: string | null;
  created_at: string;
  comment_count?: number;
  asset_url?: string;
  asset_type?: string;
}

export default function PostsGrid({ clientId }: PostsGridProps) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    loadPosts();
  }, [clientId]);

  const loadPosts = async () => {
    try {
      // Get published posts with asset information
      const { data: postsData, error } = await supabase
        .from('posts')
        .select(`
          *,
          assets!inner(file_url, file_type)
        `)
        .eq('client_id', clientId)
        .eq('status', 'published')
        .order('scheduled_for', { ascending: false });

      if (error) throw error;

      // Get comment counts
      const postIds = postsData?.map(p => p.id) || [];
      const { data: commentCounts } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds);

      const countMap = new Map();
      commentCounts?.forEach(c => {
        countMap.set(c.post_id, (countMap.get(c.post_id) || 0) + 1);
      });

      const postsWithCounts = postsData?.map(post => {
        const assetData = Array.isArray(post.assets) && post.assets.length > 0 
          ? post.assets[0] 
          : null;
        
        return {
          ...post,
          comment_count: countMap.get(post.id) || 0,
          asset_url: assetData?.file_url,
          asset_type: assetData?.file_type,
        };
      }) || [];

      setPosts(postsWithCounts);
    } catch (error: any) {
      console.error('Error loading posts:', error);
      toast({
        title: "Error",
        description: "Failed to load published posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <FileText className="h-8 w-8" />;
    if (fileType.startsWith('image')) return <FileImage className="h-8 w-8" />;
    if (fileType.startsWith('video')) return <FileVideo className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No published posts yet</p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {posts.map((post) => (
          <div
            key={post.id}
            className="aspect-square relative group cursor-pointer overflow-hidden rounded bg-muted"
            onClick={() => setSelectedPost(post)}
          >
            {post.asset_url ? (
              post.asset_type?.startsWith('image') ? (
                <img 
                  src={post.asset_url} 
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              ) : post.asset_type?.startsWith('video') ? (
                <video 
                  src={post.asset_url}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  {getFileIcon(post.asset_type)}
                </div>
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="text-white flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-5 w-5" />
                  <span className="font-semibold">{post.comment_count || 0}</span>
                </div>
              </div>
            </div>

            {/* Comment count badge */}
            {(post.comment_count || 0) > 0 && (
              <Badge 
                variant="secondary" 
                className="absolute top-2 right-2 bg-background/80 backdrop-blur"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                {post.comment_count}
              </Badge>
            )}

            {/* Platform badge */}
            {post.platform && (
              <Badge 
                variant="outline" 
                className="absolute top-2 left-2 bg-background/80 backdrop-blur"
              >
                {post.platform}
              </Badge>
            )}
          </div>
        ))}
      </div>

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onCommentAdded={loadPosts}
        />
      )}
    </>
  );
}
