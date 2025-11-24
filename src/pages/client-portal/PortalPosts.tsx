import { useParams } from "react-router-dom";
import PostsGrid from "@/components/posts/PostsGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PortalPosts() {
  const { clientId } = useParams();

  if (!clientId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Client not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Published Posts</CardTitle>
          <CardDescription>
            View all published content and add your feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PostsGrid clientId={clientId} />
        </CardContent>
      </Card>
    </div>
  );
}
