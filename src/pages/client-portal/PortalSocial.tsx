import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { 
  SiInstagram, 
  SiFacebook, 
  SiTiktok, 
  SiLinkedin, 
  SiYoutube,
  SiX
} from "react-icons/si";

interface SocialProfile {
  id: string;
  platform: string;
  url: string;
}

interface OutletContext {
  clientId: string;
  client: {
    website: string | null;
  };
}

const platformIcons: Record<string, any> = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  tiktok: SiTiktok,
  linkedin: SiLinkedin,
  youtube: SiYoutube,
  twitter: SiX,
  x: SiX,
};

export function PortalSocial() {
  const { clientId, client } = useOutletContext<OutletContext>();
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, [clientId]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("social_profiles")
      .select("*")
      .eq("client_id", clientId)
      .order("platform");

    setProfiles(data || []);
    setLoading(false);
  };

  if (loading) {
    return <div>Loading social profiles...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Social Profiles</h1>
        <p className="text-muted-foreground">
          Your social media presence across platforms
        </p>
      </div>

      {/* Website */}
      {client.website && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                <ExternalLink className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Website</h3>
                <p className="text-sm text-muted-foreground">{client.website}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open(client.website!, "_blank")}
            >
              Visit
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Social Profiles */}
      {profiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile) => {
            const Icon = platformIcons[profile.platform.toLowerCase()] || ExternalLink;
            return (
              <Card key={profile.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold capitalize">{profile.platform}</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {profile.url}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(profile.url, "_blank")}
                  >
                    Visit
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No social profiles have been added yet.
          </p>
        </Card>
      )}
    </div>
  );
}
