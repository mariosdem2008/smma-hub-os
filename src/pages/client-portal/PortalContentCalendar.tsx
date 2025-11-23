import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";

interface Post {
  id: string;
  title: string;
  platform: string | null;
  scheduled_for: string | null;
  status: string | null;
  content: string | null;
}

interface OutletContext {
  clientId: string;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  scheduled: "default",
  published: "secondary",
};

const platformColors: Record<string, string> = {
  Instagram: "bg-pink-500",
  Facebook: "bg-blue-600",
  TikTok: "bg-black",
  LinkedIn: "bg-blue-700",
  YouTube: "bg-red-600",
};

export function PortalContentCalendar() {
  const { clientId } = useOutletContext<OutletContext>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, [clientId]);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("client_id", clientId)
      .order("scheduled_for", { ascending: true });

    setPosts(data || []);
    setLoading(false);
  };

  if (loading) {
    return <div>Loading content calendar...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Content Calendar</h1>
        <p className="text-muted-foreground">
          View all your scheduled content and campaigns
        </p>
      </div>

      {posts.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {post.scheduled_for
                          ? format(new Date(post.scheduled_for), "MMM d, yyyy")
                          : "Not scheduled"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{post.title}</p>
                      {post.content && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {post.content}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {post.platform && (
                      <Badge
                        variant="outline"
                        className={`${
                          platformColors[post.platform] || "bg-gray-500"
                        } text-white border-0`}
                      >
                        {post.platform}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[post.status || "draft"]}>
                      {post.status || "draft"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Scheduled Posts</h3>
          <p className="text-muted-foreground">
            Your agency hasn't scheduled any content yet. Check back soon!
          </p>
        </Card>
      )}
    </div>
  );
}
