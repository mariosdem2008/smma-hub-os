import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { useCreateConversation } from "@/hooks/useCreateConversation";
import { Search, MessageSquare, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  profile: {
    email: string;
    full_name: string | null;
  } | null;
}

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  company: string | null;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewConversationDialog({ open, onOpenChange }: NewConversationDialogProps) {
  const { user } = useAuth();
  const { isOwner, isAdmin, isManager } = useRole();
  const navigate = useNavigate();
  const createConversation = useCreateConversation();
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const canMessageClients = isOwner || isAdmin || isManager;

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get agency
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agency) return;

      // Fetch team members
      const { data: members } = await supabase
        .from("agency_members")
        .select("*")
        .eq("agency_id", agency.id)
        .neq("user_id", user.id); // Exclude current user

      if (members) {
        const userIds = members.map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]));
        const membersWithProfiles = members.map((member) => ({
          ...member,
          profile: profileMap.get(member.user_id) || null,
        }));

        setTeamMembers(membersWithProfiles);
      }

      // Fetch clients (only if user has permission)
      if (canMessageClients) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, name, logo_url, company")
          .eq("agency_id", agency.id)
          .order("name");

        setClients(clientData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDirectConversation = async (memberId: string) => {
    try {
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (!agency) return;

      const { data: agencyMembers } = await supabase
        .from("agency_members")
        .select("id")
        .eq("agency_id", agency.id)
        .in("user_id", [user!.id, memberId]);

      if (!agencyMembers || agencyMembers.length !== 2) return;

      const result = await createConversation.mutateAsync({
        type: "direct",
        member_ids: agencyMembers.map(m => m.id),
      });

      onOpenChange(false);
      // Navigate with conversation ID to auto-select it
      navigate("/messages", { state: { selectedConversationId: result.conversation?.id } });
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const handleStartClientConversation = async (clientId: string) => {
    try {
      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (!agency) return;

      // Get current user's agency member record
      const { data: currentMember } = await supabase
        .from("agency_members")
        .select("id")
        .eq("agency_id", agency.id)
        .eq("user_id", user!.id)
        .single();

      if (!currentMember) return;

      const result = await createConversation.mutateAsync({
        type: "client_chat",
        client_id: clientId,
        member_ids: [currentMember.id],
      });

      onOpenChange(false);
      // Navigate with conversation ID to auto-select it
      navigate("/messages", { state: { selectedConversationId: result.conversation?.id } });
    } catch (error) {
      console.error("Error creating client conversation:", error);
    }
  };

  const filteredMembers = teamMembers.filter(
    (member) =>
      member.profile?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
          <DialogDescription>
            Search for team members{canMessageClients ? " or clients" : ""} to start a conversation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {/* Team Members Section */}
                {filteredMembers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Team Members</h3>
                    </div>
                    <div className="space-y-2">
                      {filteredMembers.map((member) => (
                        <Button
                          key={member.id}
                          variant="ghost"
                          className="w-full justify-start h-auto py-2"
                          onClick={() => handleStartDirectConversation(member.user_id)}
                        >
                          <Avatar className="h-8 w-8 mr-3">
                            <AvatarFallback>
                              {member.profile?.email?.substring(0, 2).toUpperCase() || "??"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{member.profile?.full_name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{member.profile?.email}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {member.role}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clients Section */}
                {canMessageClients && filteredClients.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Clients</h3>
                    </div>
                    <div className="space-y-2">
                      {filteredClients.map((client) => (
                        <Button
                          key={client.id}
                          variant="ghost"
                          className="w-full justify-start h-auto py-2"
                          onClick={() => handleStartClientConversation(client.id)}
                        >
                          <Avatar className="h-8 w-8 mr-3">
                            <AvatarImage src={client.logo_url || undefined} />
                            <AvatarFallback>
                              {client.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{client.name}</div>
                            {client.company && (
                              <div className="text-xs text-muted-foreground">{client.company}</div>
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {filteredMembers.length === 0 && filteredClients.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No results found" : "No contacts available"}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
