import { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function WaitlistForm() {
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
      // Insert into Supabase
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

      // Send to MailerLite (don't block on failure)
      try {
        const apiKey = import.meta.env.VITE_MAILERLITE_API_KEY;
        const groupId = import.meta.env.VITE_MAILERLITE_GROUP_ID;
        
        if (apiKey && groupId) {
          await fetch("https://connect.mailerlite.com/api/subscribers", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              fields: {
                name,
                agency_size: agencySize || "",
                pain_point: painPoint || "",
              },
              groups: [groupId],
            }),
          });
        }
      } catch (mailerliteError) {
        // Log but don't show error to user
        console.error("MailerLite sync failed:", mailerliteError);
      }

      setIsSubmitting(false);
      setIsSubmitted(true);
      toast.success("You're in! Early access + lifetime 20% discount secured.");
      
      // Reset form after 5 seconds
      setTimeout(() => {
        setEmail("");
        setName("");
        setAgencySize("");
        setPainPoint("");
        setIsSubmitted(false);
      }, 5000);
    } catch (error) {
      console.error("Waitlist submission error:", error);
      toast.error("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">You're on the list!</h3>
            <p className="text-muted-foreground">
              Early access + lifetime 20% discount secured. <br />
              Check your inbox for confirmation.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inline-name">Full Name *</Label>
              <Input
                id="inline-name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-email">Email Address *</Label>
              <Input
                id="inline-email"
                type="email"
                placeholder="john@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inline-agencySize">Agency Size</Label>
              <Select value={agencySize} onValueChange={setAgencySize} disabled={isSubmitting}>
                <SelectTrigger id="inline-agencySize">
                  <SelectValue placeholder="Select team size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solo">Solo</SelectItem>
                  <SelectItem value="2–5">2–5</SelectItem>
                  <SelectItem value="6–10">6–10</SelectItem>
                  <SelectItem value="10+">10+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-painPoint">Biggest Workflow Pain</Label>
              <Input
                id="inline-painPoint"
                type="text"
                placeholder="e.g., scattered assets"
                value={painPoint}
                onChange={(e) => setPainPoint(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Joining..."
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Join Waitlist — Get 20% Off
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
