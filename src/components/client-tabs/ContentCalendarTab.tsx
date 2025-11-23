import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContentCalendarTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Calendar</CardTitle>
        <CardDescription>Schedule and manage content posts</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">No scheduled content</p>
      </CardContent>
    </Card>
  );
}
