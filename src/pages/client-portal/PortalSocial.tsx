import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { PremiumInlineEmpty, PremiumLoading, PremiumPage } from "@/components/shared/PremiumPage";
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
    return <PremiumLoading rows={2} />;
  }

  return (
    <PremiumPage
      eyebrow="Channels"
      title="Social Profiles"
      description="Your social media presence across platforms."
    >

      {/* Website */}
      {client.website && (
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
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
        <PremiumInlineEmpty
          icon={ExternalLink}
          title="No social profiles yet"
          description="Connected social profiles will appear here."
        />
      )}
    </PremiumPage>
  );
}
