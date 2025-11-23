import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Calendar, Palette } from "lucide-react";

interface OverviewTabProps {
  client: {
    email: string | null;
    phone: string | null;
    created_at: string;
    tone_of_voice: string | null;
    brand_colors: string[] | null;
  };
}

export default function OverviewTab({ client }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {client.email && (
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Email</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{client.email}</p>
            </CardContent>
          </Card>
        )}
        {client.phone && (
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Phone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{client.phone}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Client Since</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {new Date(client.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Brand Information */}
      <div className="grid gap-4 md:grid-cols-2">
        {client.tone_of_voice && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tone of Voice</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{client.tone_of_voice}</p>
            </CardContent>
          </Card>
        )}

        {client.brand_colors && client.brand_colors.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center space-y-0">
              <Palette className="mr-2 h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Brand Colors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {client.brand_colors.map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded border"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-muted-foreground">{color}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Ideas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Captions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
