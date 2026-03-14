import React from "react";
import { motion, useInView } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { BeforeAfterToggle } from "./BeforeAfterToggle";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const smoothEase = [0.22, 1, 0.36, 1] as const;

const COMPARISON_ITEMS = [
  {
    before: "Every new client adds more training, handoffs, and inconsistency.",
    after: "New clients follow the same SOP-driven workflow with less variance.",
  },
  {
    before: "Context lives in chat threads, docs, and people's heads.",
    after: "Client context is centralized and reusable across tasks and teammates.",
  },
  {
    before: "Strategy depends on one person's time and memory.",
    after: "Strategies start from approved inputs and your agency standards.",
  },
  {
    before: "Approvals and revisions create endless back-and-forth.",
    after: "Approvals are structured, tracked, and improve the next draft.",
  },
];

export function BeforeAfterSection() {
  const sectionRef = useSectionTracking("Before/After");
  const isInView = useInView(sectionRef, { once: true, amount: 0.25 });

  return (
    <motion.section
      id="comparison"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.75, ease: smoothEase }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={AlertTriangle}>The constraint</Pill>}
          title={
            <>
              Scaling breaks when knowledge
              <span className="block text-gradient-premium">isn't systemized.</span>
            </>
          }
          lede="Without a system, quality drops and context gets lost. With SMMAHUB, your process becomes repeatable."
        />

        <div className="mt-[44px] mx-auto max-w-5xl">
          <LandingCard className="p-[20px] md:p-[28px]">
            <BeforeAfterToggle items={COMPARISON_ITEMS} />
          </LandingCard>
        </div>
      </LandingContainer>
    </motion.section>
  );
}
