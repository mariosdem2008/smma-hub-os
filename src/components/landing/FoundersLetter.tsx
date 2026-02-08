import { motion } from "framer-motion";
import { AnimatedSection } from "./AnimatedSection";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";

const CAL_LINK = marketing.calUrl;

export function FoundersLetter() {
  return (
    <section id="about" className="py-[20px] border-y border-border/50">
      <div className="container mx-auto px-[4px]">
        <AnimatedSection className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
                <motion.div 
                    className="w-full aspect-[4/5] rounded-lg bg-card border border-border overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* Placeholder for a high-quality photo of the founder(s) */}
                    <img src="/placeholder.svg" alt="Founder of SMMAHUB" className="w-full h-full object-cover opacity-20" />
                </motion.div>
            </div>
            <div className="lg:col-span-7">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary mb-[4px]">
                Built by Agency Experts
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl mb-6">
                We built the tool we wished we had.
              </h2>
              <div className="space-y-[4px] text-muted-foreground">
                <p>
                  For years, we ran a successful social media marketing agency. We loved the creative work and the client wins, but we were drowning in the operational overhead. Onboarding new clients, drafting repetitive strategies, and ensuring SOPs were followed felt like running on a treadmill.
                </p>
                <p>
                  We knew there had to be a better way to scale than just hiring more people. We wanted a system that could capture our best strategies and apply them flawlessly, freeing us up to do what we do best: build relationships and think creatively.
                </p>
                <p className="font-semibold text-foreground">
                  SMMAHUB is that system. It's not just another tool—it's our agency's playbook, turned into an AI employee. We built it for us. Now, we're sharing it with you.
                </p>
              </div>
               <Button asChild size="lg" className="mt-[8px]">
                <a
                  href={CAL_LINK}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("cta_book_strategy_audit_click", { location: "founders_letter" })}
                >
                  Meet the Founders <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
