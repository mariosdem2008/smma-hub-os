import React from "react";
import { motion, useInView } from "framer-motion";
import { ClipboardList, FileText, CheckCircle2, Sparkles } from "lucide-react";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Capture context",
    body: "Turn messy client info into a structured intake your team can reuse.",
  },
  {
    icon: FileText,
    title: "Generate deliverables",
    body: "Create strategy briefs, angles, and drafts using your agency standards.",
  },
  {
    icon: CheckCircle2,
    title: "Close the loop",
    body: "Run approvals, collect feedback, and make the next draft better by default.",
  },
];

export function WorkflowSection() {
  const sectionRef = useSectionTracking("Workflow");
  const isInView = useInView(sectionRef, { once: true, amount: 0.25 });

  return (
    <motion.section
      id="workflow"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={Sparkles}>Workflow</Pill>}
          title={
            <>
              From intake to approvals,
              <span className="block text-gradient-premium">in one flow.</span>
            </>
          }
          lede="SMMAHUB keeps context structured, generates drafts, and closes the loop with approvals and iteration."
        />

        <div className="mt-[44px] mx-auto max-w-6xl grid gap-[12px] lg:grid-cols-3">
          {STEPS.map((step, idx) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.35, delay: 0.08 + idx * 0.06 }}
            >
              <LandingCard className="glass-card-hover card-lift p-[22px] md:p-[26px] h-full">
                <div className="flex items-start justify-between gap-[12px]">
                  <div className="h-10 w-10 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
                    <step.icon className="h-5 w-5 text-foreground/90" />
                  </div>
                  <div className="text-small-text text-text-muted tracking-small-text">Step {idx + 1}</div>
                </div>
                <div className="mt-[14px] text-lg font-semibold text-foreground">{step.title}</div>
                <p className="mt-[8px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                  {step.body}
                </p>
              </LandingCard>
            </motion.div>
          ))}
        </div>
      </LandingContainer>
    </motion.section>
  );
}
