import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, UserPlus } from "lucide-react";
import { createAgencyInvite, getMyAgency, getOwnerSubscriptionPlan, sendTeamInviteEmail } from "@/data";

const ROLES = ["admin", "manager", "member"];

interface InviteTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteTeamMemberDialog({ open, onOpenChange }: InviteTeamMemberDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { openUpgradeModal } = useUpgradeModal();
  const [submitting, setSubmitting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [inviteLink, setInviteLink] = useState("");
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [currentUserPlan, setCurrentUserPlan] = useState<string>("");

  useEffect(() => {
    async function fetchPlan() {
      if (!user) return;

      const agency = await getMyAgency();
      const plan = await getOwnerSubscriptionPlan(agency.user_id);
      setCurrentUserPlan(plan || "free");
    }
    
    if (open) {
      fetchPlan();
    }
  }, [user, open]);

  const handleInvite = async () => {
    if (!inviteEmail || !user) {
      toast({
        title: "Validation Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    // Check if trying to invite as admin without Agency Plus
    if (inviteRole === 'admin' && currentUserPlan !== 'agency_plus') {
      toast({
        title: "Upgrade Required",
        description: "Multi-admin feature requires Agency Plus plan",
        variant: "destructive",
      });
      openUpgradeModal({ feature: 'Multi-admin', suggestedPlan: 'agency_plus' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const inviteRow = await createAgencyInvite(inviteEmail, inviteRole);

      const link = inviteRow.token ? `${window.location.origin}/invite/${inviteRow.token}` : "";
      setInviteLink(link);
      setShowInviteLink(Boolean(inviteRow.token));

      const emailResult = inviteRow.token
        ? await sendTeamInviteEmail({
            inviteToken: inviteRow.token,
          })
        : { success: false };

      toast({
        title: "Success",
        description: (emailResult as any)?.success === false
          ? "Invitation created, but email could not be sent. Share the link manually."
          : "Invitation created and email sent successfully",
      });

      setInviteEmail("");
      setInviteRole("manager");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create invitation",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: "Copied",
      description: "Invite link copied to clipboard",
    });
  };

  const handleClose = () => {
    setShowInviteLink(false);
    setInviteLink("");
    setInviteEmail("");
    setInviteRole("manager");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join your agency
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem 
                      key={role} 
                      value={role}
                      disabled={role === 'admin' && currentUserPlan !== 'agency_plus'}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                      {role === 'admin' && currentUserPlan !== 'agency_plus' && (
                        <span className="text-xs text-muted-foreground ml-1">(Agency Plus)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {inviteRole === 'admin' && currentUserPlan === 'agency_plus' && (
                <p className="text-xs text-muted-foreground">
                  Admins have full management permissions like owners
                </p>
              )}
            </div>
          </div>

          <Button onClick={handleInvite} disabled={submitting} className="w-full">
            {submitting ? "Sending..." : "Send Invitation"}
          </Button>

          {showInviteLink && (
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label>Invitation Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={inviteLink}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with your team member. It expires in 7 days.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
