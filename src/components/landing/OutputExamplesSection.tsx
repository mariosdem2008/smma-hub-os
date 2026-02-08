import React from "react";
import { motion, useInView } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { OutputExamples } from "./OutputExamples";
import { LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

export function OutputExamplesSection() {
  const sectionRef = useSectionTracking("Output Examples");
  const isInView = useInView(sectionRef, { once: true, amount: 0.25 });

  return (
    <motion.section
      id="examples"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={Sparkles}>Examples</Pill>}
          title={
            <>
              See what “good” looks like
              <span className="block text-gradient-premium">before you systemize it.</span>
            </>
          }
          lede="Illustrative examples only. In production, outputs follow your approved SOPs, brand standards, and client context."
        />

        <div className="mt-[44px]">
          <OutputExamples />
        </div>
      </LandingContainer>
    </motion.section>
  );
}

