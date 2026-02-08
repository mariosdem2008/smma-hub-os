import { motion } from "framer-motion";
import { StaggerContainer, StaggerItem, AnimatedSection } from "./AnimatedSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, ShieldCheck, Star } from "lucide-react";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";

const CAL_LINK = marketing.calUrl;

const PROGRAM_BENEFITS = [
    {
        icon: Star,
        title: "Influence the Roadmap",
        description: "As a founding member, your feedback directly shapes the future of the platform. You're not just a user; you're a co-creator."
    },
    {
        icon: ShieldCheck,
        title: "Locked-In Founder Pricing",
        description: "You'll receive a significant, permanent discount on our top-tier plan—a benefit that will never be offered again."
    },
    {
        icon: Zap,
        title: "White-Glove Onboarding",
        description: "Receive personalized setup and strategy sessions with our founding team to ensure you're maximizing ROI from day one."
    }
];

export function FoundersProgram() {
  return (
    <section id="founders-program" className="py-[20px] bg-primary/5">
      <div className="container mx-auto px-[4px]">
        <AnimatedSection className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-[4px]">An Exclusive, One-Time Opportunity</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl mb-6">
                Become a Founding Member
            </h2>
            <p className="max-w-2xl mx-auto text-muted-foreground mb-10">
                We are inviting a small group of ambitious agency owners to join us as founding members. This is a unique opportunity to gain an unfair advantage in the market and co-create the future of agency operations.
            </p>

            <StaggerContainer className="grid gap-6 md:grid-cols-3 text-left">
                {PROGRAM_BENEFITS.map(benefit => (
                    <StaggerItem key={benefit.title}>
                        <div className="h-full p-6 rounded-lg bg-card border border-border">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-[4px]">
                                <benefit.icon className="w-5 h-5 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                            <p className="text-sm text-muted-foreground">{benefit.description}</p>
                        </div>
                    </StaggerItem>
                ))}
            </StaggerContainer>

            <div className="mt-10">
                <Button asChild size="lg" className="btn-glow">
                    <a
                        href={CAL_LINK}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => track("cta_book_strategy_audit_click", { location: "founders_program" })}
                    >
                        Apply for the Founder's Program <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                </Button>
                <p className="text-xs text-muted-foreground mt-3">Applications are reviewed on a rolling basis. Spots are limited.</p>
            </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
