import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface InstagramRequirementsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  showError?: boolean;
  errorMessage?: string;
}

export function InstagramRequirementsModal({
  open,
  onOpenChange,
  onConfirm,
  showError = false,
  errorMessage,
}: InstagramRequirementsModalProps) {
  const [copied, setCopied] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText("https://facebook.com/pages/create");
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Before You Connect Instagram</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Instagram auto-posting requires a Facebook Page. Instagram Professional alone is not
            enough — Meta will reject the connection unless the account is linked to a Facebook
            Page where you are an Admin.
          </DialogDescription>
        </DialogHeader>

        {showError && errorMessage && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">{errorMessage}</p>
            <p className="text-xs text-destructive/80 mt-1">
              Please verify all requirements below before trying again.
            </p>
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium">Instagram Professional Account</p>
                <p className="text-xs text-muted-foreground">
                  Must be Business or Creator account
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium">Facebook Page created</p>
                <p className="text-xs text-muted-foreground">Not a personal profile</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium">Instagram linked to the Facebook Page</p>
                <p className="text-xs text-muted-foreground">Connected in Instagram settings</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium">You are Page Admin</p>
                <p className="text-xs text-muted-foreground">Admin role required for posting</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-medium">To enable Instagram auto-posting:</p>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="font-medium text-foreground">1)</span>
                <div>
                  <p className="text-foreground">Your Instagram is a Professional account</p>
                  <p className="text-xs">
                    Settings → Account → Switch to Professional account
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="font-medium text-foreground">2)</span>
                <div>
                  <p className="text-foreground">You have a Facebook Page</p>
                  <button
                    onClick={handleCopyUrl}
                    className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1 mt-1 transition-colors"
                  >
                    <span className="font-mono">https://facebook.com/pages/create</span>
                    <Copy className={`h-3 w-3 ${copied ? "text-green-500" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="font-medium text-foreground">3)</span>
                <div>
                  <p className="text-foreground">Link your Instagram to the Page</p>
                  <p className="text-xs">
                    Instagram → Settings → Account → Sharing to other apps → Facebook
                  </p>
                  <p className="text-xs font-medium text-foreground mt-1">
                    Select your Facebook Page (NOT your personal profile)
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="font-medium text-foreground">4)</span>
                <div>
                  <p className="text-foreground">Log into Facebook with the account that is Admin of the Page</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">
            I've Completed These Steps
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
