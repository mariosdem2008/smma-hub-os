import React from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Check, CreditCard, Eye, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const CAL_LINK = marketing.calUrl;

const WHATS_INCLUDED = [
  "Agency playbooks, quality rules, and approval logic",
  "Client context hub with goals, constraints, and operating history",
  "Strategy, creation, and workflow support from specialist AI roles",
  "Approval workflows and client collaboration surfaces",
  "Reporting, exports, and operating visibility",
  "Guided rollout scoped to your workflow reality",
];

export default function Pricing() {
  const sectionRef = useSectionTracking("Pricing");
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      id="pricing"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.75 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={CreditCard}>Pricing</Pill>}
          title={
            <>
              Start with fit.
              <span className="block text-gradient-premium">Then scope the rollout.</span>
            </>
          }
          lede="Most agencies begin with a Strategy Audit so we can map the operating model, define what to systemize first, and scope the right rollout path."
        />

        <div className="mt-[44px] mx-auto max-w-6xl grid gap-[12px] lg:grid-cols-2 lg:items-start">
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <LandingCard className="p-[22px] md:p-[26px]">
              <div className="text-sm font-semibold tracking-tight text-foreground">What's included</div>
              <div className="mt-[6px] text-sm text-text-muted">
                Core capabilities included across plans. Exact scope depends on your workflow.
              </div>

              <ul className="mt-[16px] space-y-[10px]">
                {WHATS_INCLUDED.map((line) => (
                  <li key={line} className="flex items-start gap-[10px]">
                    <div className="mt-[2px] h-6 w-6 rounded-full bg-success/15 border border-white/10 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-success" />
                    </div>
                    <p className="text-body-mobile md:text-body-desktop text-text-secondary leading-body">{line}</p>
                  </li>
                ))}
              </ul>
            </LandingCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.65, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <LandingCard className="gradient-border-animated p-[22px] md:p-[26px]">
              <div className="flex items-start gap-[12px]">
                <div className="h-10 w-10 rounded-xl bg-success/15 border border-white/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">Strategy Audit first</div>
                  <div className="mt-[6px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                    We review your delivery process, identify bottlenecks, and define a rollout plan for systemizing your workflow.
                  </div>
                </div>
              </div>

              <div className="mt-[18px] flex flex-col gap-[12px]">
                <Button asChild size="lg" className="w-full btn-primary-enhanced tracking-cta-text">
                  <a
                    href={CAL_LINK}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-[8px]"
                    onClick={() => track("cta_book_strategy_audit_click", { location: "pricing_block" })}
                  >
                    Book strategy audit
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Button>

                <Button asChild size="lg" variant="outline" className="w-full btn-secondary-enhanced tracking-cta-text">
                  <a href="/pricing" className="inline-flex items-center justify-center gap-[8px]" onClick={() => track("pricing_view_click", { location: "pricing_block" })}>
                    <Eye className="w-4 h-4" />
                    See plans
                  </a>
                </Button>
              </div>

              <div className="mt-[16px] text-small-text text-text-muted">
                No hard sell. Just a clear plan and realistic numbers.
              </div>
            </LandingCard>
          </motion.div>
        </div>
      </LandingContainer>
    </motion.section>
  );
}
