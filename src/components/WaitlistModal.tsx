import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !name) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call - in production, replace with actual waitlist API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
    
    toast.success("Successfully joined the waitlist!");
    
    // Reset form after 3 seconds and close
    setTimeout(() => {
      setEmail("");
      setName("");
      setIsSubmitted(false);
      onOpenChange(false);
    }, 3000);
  };

  const handleClose = () => {
    setEmail("");
    setName("");
    setIsSubmitted(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!isSubmitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Join the Waitlist</DialogTitle>
              <DialogDescription>
                Be the first to know when SMMAHUB launches. Get exclusive early access and special launch pricing.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  "Joining..."
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Join Waitlist
                  </>
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-2xl mb-2">You're on the list!</DialogTitle>
            <DialogDescription className="text-base">
              We'll send you an email when SMMAHUB launches. <br />
              Check your inbox for a confirmation.
            </DialogDescription>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
