import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Users, FileText, CheckSquare, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    clients: 0,
    posts: 0,
    tasks: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      // Get agency
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agency) return;

      // Get clients count
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agency.id);

      // Get posts count
      const { count: postsCount } = await supabase
        .from("posts")
        .select("*, clients!inner(agency_id)", { count: "exact", head: true })
        .eq("clients.agency_id", agency.id);

      // Get tasks count
      const { count: tasksCount } = await supabase
        .from("tasks")
        .select("*, clients!inner(agency_id)", { count: "exact", head: true })
        .eq("clients.agency_id", agency.id);

      setStats({
        clients: clientsCount || 0,
        posts: postsCount || 0,
        tasks: tasksCount || 0,
      });
    };

    fetchStats();
  }, [user]);

  const statCards = [
    {
      title: "Total Clients",
      value: stats.clients,
      description: "Active client accounts",
      icon: Users,
    },
    {
      title: "Scheduled Posts",
      value: stats.posts,
      description: "Content in pipeline",
      icon: FileText,
    },
    {
      title: "Active Tasks",
      value: stats.tasks,
      description: "Tasks in progress",
      icon: CheckSquare,
    },
    {
      title: "Growth Rate",
      value: "+12%",
      description: "Month over month",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your agency overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates across your clients</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Tasks and posts due soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
