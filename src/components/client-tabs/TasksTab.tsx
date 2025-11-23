import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TasksTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardDescription>Track work for this client</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">No active tasks</p>
      </CardContent>
    </Card>
  );
}
