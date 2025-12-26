import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function TeamTab() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>Manage agency members and invitations.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => navigate("/team")}>Open Team Management</Button>
      </CardContent>
    </Card>
  );
}

