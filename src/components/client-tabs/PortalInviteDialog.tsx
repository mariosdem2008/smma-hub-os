import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { sendPortalInviteEmail } from "@/lib/invitations";

interface PortalInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  portalSlug: string;
  onInviteSent: () => void;
}

export function PortalInviteDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  portalSlug,
  onInviteSent,
}: PortalInviteDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email.trim() || !user) return;

    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if email already has access
      const { data: existing } = await supabase
        .from("client_portal_users")
        .select("id, accepted_at")
        .eq("client_id", clientId)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existing?.accepted_at) {
        toast({
          title: "Already Invited",
          description: "This email already has access to the portal.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Generate secure token
      const { data: tokenData } = await supabase.rpc("generate_portal_invite_token");
      
      if (!tokenData) throw new Error("Failed to generate invitation token");

      // Get agency info
      const { data: membership } = await supabase
        .from("agency_members")
        .select("agency_id, agencies(name)")
        .eq("user_id", user.id)
        .single();

      if (!membership) throw new Error("Agency not found");

      const agencyName = (membership.agencies as any)?.name || "Your Agency";
      const agencyId = membership.agency_id;

      // Get user profile for inviter name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const inviterName = profile?.full_name || user.email || "Your Agency";

      // Create or update invitation
      if (existing) {
        // Update existing pending invitation
        await supabase
          .from("client_portal_users")
          .update({
            invite_token: tokenData,
            invited_by: user.id,
            invited_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Create new invitation
        await supabase
          .from("client_portal_users")
          .insert({
            client_id: clientId,
            email: normalizedEmail,
            invite_token: tokenData,
            invited_by: user.id,
            role: "client_viewer",
          });
      }

      // Send invitation email
      const portalUrl = `${window.location.origin}/client-portal/${portalSlug}/accept?token=${tokenData}`;
      
      const emailResult = await sendPortalInviteEmail({
        email: normalizedEmail,
        clientName,
        portalUrl,
        agencyName,
        inviterName,
        agencyId,
      });

      if (!emailResult.success) {
        throw new Error("Failed to send invitation email");
      }

      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${normalizedEmail}`,
      });

      setEmail("");
      onOpenChange(false);
      onInviteSent();
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      
      let errorMessage = "Failed to send invitation";
      
      // Provide specific feedback based on error type
      if (error.message?.includes("permission denied") || error.message?.includes("policy")) {
        errorMessage = "You don't have permission to invite users to this client portal";
      } else if (error.message?.includes("token")) {
        errorMessage = "Failed to generate invitation token. Please try again.";
      } else if (error.message?.includes("email")) {
        errorMessage = "Failed to send invitation email. Please check the email address.";
      }
      
      toast({
        title: "Error",
        description: error.message || errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User to Portal</DialogTitle>
          <DialogDescription>
            Send an invitation to access the {clientName} client portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              An invitation link will be sent to this email address. The invitation expires in 7 days.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading || !email.trim()}>
            {loading ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
