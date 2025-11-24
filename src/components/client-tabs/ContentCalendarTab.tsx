import { useEffect, useState } from "react";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import ApprovalReviewModal from "@/components/ApprovalReviewModal";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarIcon, Calendar as CalendarViewIcon, List, Send, CheckCircle, XCircle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  title: string;
  platform: string | null;
  scheduled_for: string | null;
  status: string | null;
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface ContentCalendarTabProps {
  clientId: string;
}

const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube"];
const STATUSES = ["draft", "in_review", "approved", "rejected", "scheduled", "published"];
const APPROVAL_STATUSES = ["draft", "in_review", "approved", "rejected"];

export default function ContentCalendarTab({ clientId }: ContentCalendarTabProps) {
  const { toast } = useToast();
  const { canCreateContent, isViewer, role, canManageTeam } = useRole();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    title: "",
    platform: "",
    status: "draft",
  });
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    postId: string;
    postTitle: string;
    action: 'approve' | 'reject';
  }>({ open: false, postId: '', postTitle: '', action: 'approve' });

  const canApprove = role === 'owner' || role === 'admin' || role === 'manager';

  useEffect(() => {
    fetchPosts();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`posts-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("client_id", clientId)
      .order("scheduled_for", { ascending: true, nullsFirst: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch posts",
        variant: "destructive",
      });
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.platform) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({
      client_id: clientId,
      title: formData.title,
      platform: formData.platform,
      scheduled_for: scheduledDate?.toISOString() || null,
      status: formData.status,
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
      setFormData({ title: "", platform: "", status: "draft" });
      setScheduledDate(undefined);
      setIsDialogOpen(false);
      fetchPosts();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (postId: string, newStatus: string) => {
    const { error } = await supabase
      .from("posts")
      .update({ status: newStatus })
      .eq("id", postId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Status updated successfully",
      });
      fetchPosts();
    }
  };

  const handleReview = async (comment: string) => {
    const newStatus = reviewModal.action === 'approve' ? 'approved' : 'rejected';
    const { error } = await supabase
      .from("posts")
      .update({ 
        status: newStatus,
        review_comment: comment || null,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", reviewModal.postId);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to ${reviewModal.action} post`,
        variant: "destructive",
      });
      throw error;
    }

    // Send notification
    const post = posts.find(p => p.id === reviewModal.postId);
    if (post) {
      try {
        await supabase.functions.invoke("send-approval-notification", {
          body: {
            contentType: 'post',
            contentId: reviewModal.postId,
            contentTitle: post.title,
            clientId: clientId,
            action: newStatus,
            comment: comment || undefined,
          },
        });
      } catch (notifError) {
        console.error("Failed to send notification:", notifError);
      }
    }

    toast({
      title: "Success",
      description: `Post ${reviewModal.action}d successfully`,
    });
    fetchPosts();
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "approved":
        return "green";
      case "in_review":
        return "default";
      case "rejected":
        return "destructive";
      case "published":
        return "default";
      case "scheduled":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getPostsForDate = (date: Date) => {
    let filtered = posts.filter((post) =>
      post.scheduled_for && isSameDay(new Date(post.scheduled_for), date)
    );
    if (statusFilter !== "all") {
      filtered = filtered.filter(post => post.status === statusFilter);
    }
    return filtered;
  };

  const filteredPosts = statusFilter === "all" 
    ? posts 
    : posts.filter(post => post.status === statusFilter);

  const getPostCountForDate = (date: Date) => {
    return getPostsForDate(date).length;
  };

  const handleDateClick = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsSheetOpen(true);
    }
  };

  const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : [];

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold">Content Calendar</h3>
          <p className="text-sm text-muted-foreground">
            {isViewer ? "View scheduled content posts" : "Schedule and manage content posts"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "list")}>
            <TabsList>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarViewIcon className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {canCreateContent && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Post
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Post</DialogTitle>
              <DialogDescription>
                Schedule a new post for this client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter post title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">
                  Platform <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) =>
                    setFormData({ ...formData, platform: value })
                  }
                >
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Scheduled Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? (
                        format(scheduledDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
        </div>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              {APPROVAL_STATUSES.map(status => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating..." : "Create Post"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          )}
        </div>
      </div>

      {viewMode === "calendar" ? (
        <Card>
          <CardContent className="p-6 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateClick}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              className="mx-auto"
              components={{
                DayContent: ({ date }) => {
                  const count = getPostCountForDate(date);
                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span>{date.getDate()}</span>
                      {count > 0 && (
                        <span className="absolute bottom-0 right-1/2 translate-x-1/2 flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                        </span>
                      )}
                    </div>
                  );
                },
              }}
            />
          </CardContent>
        </Card>
      ) : filteredPosts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No posts scheduled yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      {post.scheduled_for
                        ? format(new Date(post.scheduled_for), "PPP")
                        : "Not scheduled"}
                    </TableCell>
                    <TableCell>
                      {post.platform || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{post.title}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(post.status) as any}>
                        {post.status || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {post.status === 'draft' && canCreateContent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(post.id, 'in_review')}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Submit
                          </Button>
                        )}
                        {post.status === 'in_review' && canApprove && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600"
                              onClick={() => setReviewModal({
                                open: true,
                                postId: post.id,
                                postTitle: post.title,
                                action: 'approve'
                              })}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => setReviewModal({
                                open: true,
                                postId: post.id,
                                postTitle: post.title,
                                action: 'reject'
                              })}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Posts for {selectedDate && format(selectedDate, "MMMM d, yyyy")}
            </SheetTitle>
            <SheetDescription>
              {selectedDatePosts.length} post{selectedDatePosts.length !== 1 ? "s" : ""} scheduled
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {selectedDatePosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No posts scheduled for this day
              </p>
            ) : (
               selectedDatePosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium">{post.title}</h4>
                        <Badge variant={getStatusBadgeVariant(post.status) as any}>
                          {post.status || "draft"}
                        </Badge>
                      </div>
                      {post.platform && (
                        <p className="text-sm text-muted-foreground">
                          Platform: {post.platform}
                        </p>
                      )}
                      {post.scheduled_for && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.scheduled_for), "h:mm a")}
                        </p>
                      )}
                      {post.review_comment && (
                        <div className="text-sm p-2 rounded bg-muted">
                          <p className="font-medium text-xs mb-1">Review Comment:</p>
                          <p className="text-muted-foreground">{post.review_comment}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        {post.status === 'draft' && canCreateContent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(post.id, 'in_review')}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Submit for Review
                          </Button>
                        )}
                        {post.status === 'in_review' && canApprove && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600"
                              onClick={() => setReviewModal({
                                open: true,
                                postId: post.id,
                                postTitle: post.title,
                                action: 'approve'
                              })}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => setReviewModal({
                                open: true,
                                postId: post.id,
                                postTitle: post.title,
                                action: 'reject'
                              })}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ApprovalReviewModal
        open={reviewModal.open}
        onOpenChange={(open) => setReviewModal({ ...reviewModal, open })}
        contentType="post"
        contentTitle={reviewModal.postTitle}
        action={reviewModal.action}
        onSubmit={handleReview}
      />
    </div>
  );
}
