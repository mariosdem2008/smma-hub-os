import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
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
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<'client' | 'approver' | 'viewer'>('client');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get agency info
      const { data: agencyMember } = await supabase
        .from("agency_members")
        .select("agency_id, agencies!inner(name)")
        .eq("user_id", user.id)
        .single();

      if (!agencyMember) throw new Error("Agency not found");

      const agencyName = (agencyMember.agencies as any)?.name || "Your Agency";
      const agencyId = agencyMember.agency_id;

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("client_users")
        .select("*")
        .eq("client_id", clientId)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingUser) {
        toast({
          title: "User Already Exists",
          description: "This user already has access to the portal",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check for existing pending invite
      const { data: existingInvite } = await supabase
        .from("client_invites")
        .select("*")
        .eq("client_id", clientId)
        .eq("email", normalizedEmail)
        .eq("accepted", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (existingInvite) {
        toast({
          title: "Invitation Already Sent",
          description: "An invitation has already been sent to this email",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      await sendPortalInviteEmail({
        email: normalizedEmail,
        clientName,
        portalBaseUrl: `${window.location.origin}/client/accept-invite`,
        agencyName,
        inviterName: user.email || "Your Agency",
        agencyId,
        clientId,
        fullName: fullName || undefined,
        role,
      });

      toast({
        title: "Invitation Sent",
        description: `Portal invitation sent to ${normalizedEmail}`,
      });

      setEmail("");
      setFullName("");
      setRole('client');
      onInviteSent();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name (optional)</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Client Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Portal Role</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)} disabled={loading}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client (Can approve & comment)</SelectItem>
                <SelectItem value="approver">Approver (Can only approve)</SelectItem>
                <SelectItem value="viewer">Viewer (Read-only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading || !email.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
