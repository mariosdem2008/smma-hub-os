import React from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Check, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";
import { LandingCard, LandingContainer, Pill } from "./LandingPrimitives";

const CAL_LINK = marketing.calUrl;
const DEMO_LINK = marketing.demoUrl;

const TRUST_INDICATORS = ["No card required to book", "Secure by design", "Export anytime"];

export default function FinalCTA() {
  const sectionRef = useSectionTracking("Final CTA");
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-lg lp-section"
    >
      <LandingContainer className="relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <LandingCard className="gradient-border-animated p-[26px] md:p-[56px] text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 left-1/3 w-[520px] h-[520px] bg-brand-primary/12 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 right-1/3 w-[520px] h-[520px] bg-accent/10 rounded-full blur-3xl" />
            </div>

            <div className="relative">
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.35, delay: 0.16 }}
                className="flex justify-center"
              >
                <Pill icon={Sparkles}>Next step</Pill>
              </motion.div>

              <h2 className="mt-[16px] text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
                Ready to scale without hiring?
                <span className="block text-gradient-premium">Start with a strategy audit.</span>
              </h2>

              <p className="mt-[16px] mx-auto max-w-2xl text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                We map your workflow, define what to systemize first, and outline a rollout plan for consistent delivery.
              </p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.35, delay: 0.22 }}
                className="mt-[30px] flex flex-col sm:flex-row justify-center gap-[12px]"
              >
                <Button asChild size="lg" className="btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text">
                  <a
                    href={CAL_LINK}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-[8px]"
                    onClick={() => track("cta_book_strategy_audit_click", { location: "final_cta" })}
                  >
                    Book strategy audit
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Button>

                {DEMO_LINK ? (
                  <Button asChild size="lg" variant="outline" className="btn-secondary-enhanced group tracking-cta-text">
                    <a
                      href={DEMO_LINK}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-[8px]"
                      onClick={() => track("cta_watch_demo_click", { location: "final_cta" })}
                    >
                      <Play className="w-4 h-4" />
                      Watch demo
                    </a>
                  </Button>
                ) : null}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="mt-[22px] flex flex-wrap justify-center gap-[16px] md:gap-[22px]"
              >
                {TRUST_INDICATORS.map((indicator) => (
                  <span key={indicator} className="flex items-center gap-[8px] text-small-text text-text-secondary">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15 border border-white/10 flex-shrink-0">
                      <Check className="h-3 w-3 text-success" />
                    </span>
                    {indicator}
                  </span>
                ))}
              </motion.div>
            </div>
          </LandingCard>
        </motion.div>
      </LandingContainer>
    </motion.section>
  );
}
