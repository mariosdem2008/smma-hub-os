import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface ClientHeaderProps {
  name: string;
  logoUrl: string | null;
  niche: string | null;
  website: string | null;
  brandColors: string[] | null;
}

export default function ClientHeader({
  name,
  logoUrl,
  niche,
  website,
  brandColors,
}: ClientHeaderProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const primaryColor = brandColors && brandColors.length > 0 ? brandColors[0] : null;

  return (
    <div className="flex items-start gap-6 rounded-lg border bg-card p-6">
      <Avatar className="h-20 w-20">
        <AvatarImage src={logoUrl || undefined} alt={name} />
        <AvatarFallback className="text-2xl font-semibold">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-3">
        <div>
          <h1 className="text-3xl font-bold">{name}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {niche && (
            <Badge variant="secondary" className="text-sm">
              {niche}
            </Badge>
          )}

          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {website.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {primaryColor && (
            <Badge
              variant="outline"
              className="flex items-center gap-2"
              style={{ borderColor: primaryColor }}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
              <span className="text-xs">{primaryColor}</span>
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
