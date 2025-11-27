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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [agencySize, setAgencySize] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !name) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("waitlist_subscribers")
        .insert({
          email,
          name,
          agency_size: agencySize || null,
          pain_point: painPoint || null,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("This email is already on the waitlist!");
        } else {
          toast.error("Failed to join waitlist. Please try again.");
        }
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setIsSubmitted(true);
      toast.success("Successfully joined the waitlist!");
      
      // Reset form after 3 seconds and close
      setTimeout(() => {
        setEmail("");
        setName("");
        setAgencySize("");
        setPainPoint("");
        setIsSubmitted(false);
        onOpenChange(false);
      }, 3000);
    } catch (error) {
      console.error("Waitlist submission error:", error);
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setName("");
    setAgencySize("");
    setPainPoint("");
    setIsSubmitted(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!isSubmitted ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Get Early Access + 20% Lifetime Discount</DialogTitle>
              <DialogDescription className="text-base">
                Join the waitlist to get exclusive early access when we launch on December 23rd, 
                plus lock in a <strong className="text-foreground">20% lifetime discount</strong> on any paid plan.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
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
                <Label htmlFor="email">Email Address *</Label>
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
              <div className="space-y-2">
                <Label htmlFor="agencySize">Agency Size</Label>
                <Select value={agencySize} onValueChange={setAgencySize} disabled={isSubmitting}>
                  <SelectTrigger id="agencySize">
                    <SelectValue placeholder="Select team size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">Solo</SelectItem>
                    <SelectItem value="2-5">2–5</SelectItem>
                    <SelectItem value="6-10">6–10</SelectItem>
                    <SelectItem value="10+">10+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="painPoint">Biggest Workflow Pain</Label>
                <Textarea
                  id="painPoint"
                  placeholder="What's your biggest challenge managing social media for clients?"
                  value={painPoint}
                  onChange={(e) => setPainPoint(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
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
