import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Message {
  id: string;
  body: string;
  created_at: string;
  sender_type: string;
  sender_name: string | null;
}

interface ProjectMessagesTabProps {
  projectId: string;
  clientId: string;
}

export default function ProjectMessagesTab({ projectId, clientId }: ProjectMessagesTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMessages();
  }, [projectId]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          id,
          body,
          created_at,
          sender_type,
          sender_agency_member_id,
          sender_client_user_id
        `)
        .eq("related_project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch sender names
      const messagesWithNames = await Promise.all((data || []).map(async (msg) => {
        let senderName = "Unknown";
        
        if (msg.sender_agency_member_id) {
          const { data: member } = await supabase
            .from("agency_members")
            .select("user_id")
            .eq("id", msg.sender_agency_member_id)
            .single();
          
          if (member) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", member.user_id)
              .single();
            senderName = profile?.full_name || profile?.email || "Agency Member";
          }
        } else if (msg.sender_client_user_id) {
          const { data: clientUser } = await supabase
            .from("client_users")
            .select("full_name, email")
            .eq("id", msg.sender_client_user_id)
            .single();
          senderName = clientUser?.full_name || clientUser?.email || "Client";
        }

        return {
          id: msg.id,
          body: msg.body || "",
          created_at: msg.created_at,
          sender_type: msg.sender_type,
          sender_name: senderName
        };
      }));

      setMessages(messagesWithNames);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get agency member ID
      const { data: member } = await supabase
        .from("agency_members")
        .select("id, agency_id")
        .eq("user_id", user.id)
        .single();

      if (!member) throw new Error("Not an agency member");

      // Find or create conversation for this project
      let conversationId: string;
      
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", clientId)
        .eq("type", "client_chat")
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            agency_id: member.agency_id,
            client_id: clientId,
            type: "client_chat",
            title: "Project Discussion"
          })
          .select("id")
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;
      }

      // Insert message
      const { error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          agency_id: member.agency_id,
          client_id: clientId,
          body: newMessage.trim(),
          sender_type: "agency_member",
          sender_agency_member_id: member.id,
          related_project_id: projectId
        });

      if (error) throw error;

      setNewMessage("");
      fetchMessages();
      
      toast({
        title: "Message sent",
        description: "Your message has been sent to the client"
      });
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Messages</h3>
            <p className="text-sm text-muted-foreground">
              Start a conversation about this project with your client.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender_type === "agency_member" ? "flex-row-reverse" : ""}`}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {getInitials(msg.sender_name)}
                </AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[70%] ${
                  msg.sender_type === "agency_member"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                } rounded-lg p-3`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{msg.sender_name}</span>
                  <Badge variant="outline" className="text-[10px] px-1">
                    {msg.sender_type === "agency_member" ? "Agency" : "Client"}
                  </Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                <span className="text-[10px] opacity-70 mt-1 block">
                  {format(new Date(msg.created_at), "MMM d, h:mm a")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={sending || !newMessage.trim()}
            className="self-end"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
