import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Palette, 
  Globe, 
  MessageSquare, 
  CalendarDays,
  CheckCircle2,
  Clock,
  Plus,
  Edit,
  FileText
} from "lucide-react";

interface OverviewTabProps {
  clientId: string;
  client: {
    website: string | null;
    niche: string | null;
    tone_of_voice: string | null;
    brand_colors: string[] | null;
    notes: string | null;
  };
  onNotesUpdate: (notes: string) => void;
}

interface Stats {
  totalPosts: number;
  completedTasks: number;
  upcomingPosts: number;
}

export default function OverviewTab({ clientId, client, onNotesUpdate }: OverviewTabProps) {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({
    totalPosts: 0,
    completedTasks: 0,
    upcomingPosts: 0,
  });
  const [isEditNotesOpen, setIsEditNotesOpen] = useState(false);
  const [notes, setNotes] = useState(client.notes || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [clientId]);

  const fetchStats = async () => {
    // Fetch total posts
    const { count: postsCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);

    // Fetch completed tasks
    const { count: completedTasksCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "completed");

    // Fetch upcoming posts (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { count: upcomingPostsCount } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("scheduled_for", new Date().toISOString())
      .lte("scheduled_for", sevenDaysFromNow.toISOString());

    setStats({
      totalPosts: postsCount || 0,
      completedTasks: completedTasksCount || 0,
      upcomingPosts: upcomingPostsCount || 0,
    });
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ notes })
      .eq("id", clientId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Notes saved successfully",
      });
      onNotesUpdate(notes);
      setIsEditNotesOpen(false);
    }
    setSaving(false);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Brand Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.website && (
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Website</p>
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {client.website}
                  </a>
                </div>
              </div>
            )}

            {client.niche && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Niche</p>
                  <p className="text-sm text-muted-foreground">{client.niche}</p>
                </div>
              </div>
            )}

            {client.tone_of_voice && (
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Tone of Voice</p>
                  <p className="text-sm text-muted-foreground">{client.tone_of_voice}</p>
                </div>
              </div>
            )}

            {client.brand_colors && client.brand_colors.length > 0 && (
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Brand Colors</p>
                  <div className="flex flex-wrap gap-2">
                    {client.brand_colors.map((color, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                        <div
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-mono">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Notes</CardTitle>
            <Dialog open={isEditNotesOpen} onOpenChange={setIsEditNotesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Notes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Client Notes</DialogTitle>
                  <DialogDescription>
                    Add or update notes about this client
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this client..."
                  rows={12}
                  className="resize-none"
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditNotesOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveNotes} disabled={saving}>
                    {saving ? "Saving..." : "Save Notes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {client.notes ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.notes}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No notes added yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Key Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Key Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Scheduled Posts</p>
                  <p className="text-2xl font-bold">{stats.totalPosts}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-500/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed Tasks</p>
                  <p className="text-2xl font-bold">{stats.completedTasks}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-500/10 p-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Posts (7 days)</p>
                  <p className="text-2xl font-bold">{stats.upcomingPosts}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => setIsEditNotesOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Notes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
