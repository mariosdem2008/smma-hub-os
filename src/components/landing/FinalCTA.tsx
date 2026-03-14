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
const smoothEase = [0.22, 1, 0.36, 1] as const;

const TRUST_INDICATORS = ["Workflow-fit first", "Governed by design", "Clear rollout path"];

export default function FinalCTA() {
  const sectionRef = useSectionTracking("Final CTA");
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.8, ease: smoothEase }}
      className="section-lg lp-section"
    >
      <LandingContainer className="relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.12, ease: smoothEase }}
        >
          <LandingCard className="gradient-border-animated relative overflow-hidden p-[26px] text-center md:p-[56px]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-1/3 h-[520px] w-[520px] rounded-full bg-brand-primary/12 blur-3xl" />
              <div className="absolute -bottom-24 right-1/3 h-[520px] w-[520px] rounded-full bg-accent/10 blur-3xl" />
            </div>

            <div className="relative">
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.22, ease: smoothEase }}
                className="flex justify-center"
              >
                <Pill icon={Sparkles}>Next step</Pill>
              </motion.div>

              <h2 className="mt-[16px] text-section-headline-mobile font-semibold leading-section-headline tracking-section-headline md:text-section-headline-desktop">
                See whether SMMAHUB fits
                <span className="block text-gradient-premium">your agency operating model.</span>
              </h2>

              <p className="mx-auto mt-[16px] max-w-2xl text-body-mobile leading-body text-text-secondary md:text-body-desktop">
                We map your workflow, show where the AI employee layer fits, and define the safest rollout path for your agency.
              </p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.68, delay: 0.32, ease: smoothEase }}
                className="mt-[30px] flex flex-col justify-center gap-[12px] sm:flex-row"
              >
                <Button asChild size="lg" className="btn-primary-enhanced tracking-cta-text">
                  <a
                    href={CAL_LINK}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-[8px]"
                    onClick={() => track("cta_book_strategy_audit_click", { location: "final_cta" })}
                  >
                    Book strategy audit
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>

                {DEMO_LINK ? (
                  <Button asChild size="lg" variant="outline" className="btn-secondary-enhanced tracking-cta-text">
                    <a href="#fit" className="inline-flex items-center gap-[8px]" onClick={() => track("cta_watch_demo_click", { location: "final_cta_fit" })}>
                      <Play className="h-4 w-4" />
                      See if your agency is a fit
                    </a>
                  </Button>
                ) : null}
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.7, delay: 0.42, ease: smoothEase }}
                className="mt-[22px] flex flex-wrap justify-center gap-[16px] md:gap-[22px]"
              >
                {TRUST_INDICATORS.map((indicator) => (
                  <span key={indicator} className="flex items-center gap-[8px] text-small-text text-text-secondary">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-success/15">
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
