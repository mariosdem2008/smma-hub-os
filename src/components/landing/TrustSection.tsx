import React from "react";
import { motion, useInView } from "framer-motion";
import { FileDown, GitBranch, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const TRUST_ITEMS = [
  {
    title: "Encryption + isolation",
    description: "Encrypted in transit and at rest, with tenant isolation to prevent data crossover.",
    icon: Lock,
  },
  {
    title: "Human-in-the-loop",
    description: "AI drafts, your team approves. You decide what gets used and what ships.",
    icon: ShieldCheck,
  },
  {
    title: "Revision history",
    description: "Track changes and decisions so quality improves without losing context.",
    icon: GitBranch,
  },
  {
    title: "Data portability",
    description: "Export strategies and drafts anytime. If you leave, you take your data with you.",
    icon: FileDown,
  },
];

export function TrustSection() {
  const sectionRef = useSectionTracking("Trust");
  const isInView = useInView(sectionRef, { once: true, amount: 0.25 });

  return (
    <motion.section
      id="trust"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={Sparkles}>Trust</Pill>}
          title={
            <>
              Reliable outputs.
              <span className="block text-gradient-premium">Controlled workflows.</span>
            </>
          }
          lede="Built for production: approvals, security, and repeatability are first-class."
        />

        <div className="mt-[44px] grid gap-[12px] md:grid-cols-2">
          {TRUST_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.35, delay: 0.08 + index * 0.05 }}
              >
                <LandingCard className="glass-card-hover card-lift p-[22px] md:p-[26px] h-full">
                  <div className="flex items-start gap-[12px]">
                    <div className="h-10 w-10 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-foreground/90" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-[8px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </LandingCard>
              </motion.div>
            );
          })}
        </div>
      </LandingContainer>
    </motion.section>
  );
}
