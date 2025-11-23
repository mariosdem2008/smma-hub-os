import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  primary_font: string | null;
  secondary_font: string | null;
  brand_colors: any;
  website: string | null;
  notes: string | null;
  niche: string | null;
  tone_of_voice: string | null;
}

interface OutletContext {
  client: Client;
  clientId: string;
}

export function PortalOverview() {
  const { client } = useOutletContext<OutletContext>();
  const brandColors = Array.isArray(client.brand_colors) ? client.brand_colors : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome to Your Brand Hub</h1>
        <p className="text-muted-foreground">
          This is your centralized space to view brand details, add ideas, and manage assets.
        </p>
      </div>

      {/* Brand Overview Card */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Brand Overview</h2>
        <div className="space-y-6">
          {/* Logo */}
          {client.logo_url && (
            <div>
              <p className="text-sm font-medium mb-2">Logo</p>
              <img
                src={client.logo_url}
                alt={client.name}
                className="h-20 w-auto object-contain bg-muted p-4 rounded-lg"
              />
            </div>
          )}

          {/* Niche */}
          {client.niche && (
            <div>
              <p className="text-sm font-medium mb-2">Industry / Niche</p>
              <Badge variant="outline">{client.niche}</Badge>
            </div>
          )}

          {/* Brand Colors */}
          {brandColors.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">Brand Colors</p>
              <div className="flex flex-wrap gap-3">
                {brandColors.map((color: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-lg border shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {color}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fonts */}
          {(client.primary_font || client.secondary_font) && (
            <div>
              <p className="text-sm font-medium mb-3">Typography</p>
              <div className="space-y-2">
                {client.primary_font && (
                  <div>
                    <Badge variant="outline" className="mb-1">
                      Primary Font
                    </Badge>
                    <p className="text-lg" style={{ fontFamily: client.primary_font }}>
                      {client.primary_font}
                    </p>
                  </div>
                )}
                {client.secondary_font && (
                  <div>
                    <Badge variant="outline" className="mb-1">
                      Secondary Font
                    </Badge>
                    <p className="text-lg" style={{ fontFamily: client.secondary_font }}>
                      {client.secondary_font}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tone of Voice */}
          {client.tone_of_voice && (
            <div>
              <p className="text-sm font-medium mb-2">Tone of Voice</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.tone_of_voice}
              </p>
            </div>
          )}

          {/* Website */}
          {client.website && (
            <div>
              <p className="text-sm font-medium mb-2">Website</p>
              <a
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {client.website}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div>
              <p className="text-sm font-medium mb-2">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.notes}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions Card */}
      <Card className="p-6 bg-accent/50">
        <h2 className="text-xl font-semibold mb-4">What You Can Do</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium">✨ Add Ideas</h3>
            <p className="text-sm text-muted-foreground">
              Share your content ideas and inspiration with your agency team.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">📁 Upload Assets</h3>
            <p className="text-sm text-muted-foreground">
              Upload images, videos, and documents for your campaigns.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">📥 Download Files</h3>
            <p className="text-sm text-muted-foreground">
              Access and download all your brand assets anytime.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">👀 View Progress</h3>
            <p className="text-sm text-muted-foreground">
              See your ideas and content as they move through production.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
