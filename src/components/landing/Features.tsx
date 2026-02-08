import React from "react";
import { motion, useInView } from "framer-motion";
import { BookOpen, ClipboardList, FileText, CheckSquare, BarChart3, Users, Sparkles } from "lucide-react";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Structured intake",
    body: "Collect goals, offers, audience, and constraints in a format your team can actually use.",
  },
  {
    icon: Users,
    title: "Client context hub",
    body: "One place for the account story: voice, history, decisions, and approvals.",
  },
  {
    icon: BookOpen,
    title: "Agency standards",
    body: "Encode SOPs, templates, and quality checks so every output matches your bar.",
  },
  {
    icon: FileText,
    title: "Strategy briefs",
    body: "Generate clear, client-ready briefs your team can execute against immediately.",
  },
  {
    icon: CheckSquare,
    title: "Approval workflows",
    body: "Track review states, collect feedback, and reduce back-and-forth across stakeholders.",
  },
  {
    icon: BarChart3,
    title: "Reporting snapshots",
    body: "Summarize performance and turn learnings into better next-month strategy.",
  },
];

export default function Features() {
  const sectionRef = useSectionTracking("Features");
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <motion.section
      id="outputs"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={Sparkles}>What it replaces</Pill>}
          title={
            <>
              A repeatable client delivery system.
              <span className="block text-gradient-premium">Not another prompt tool.</span>
            </>
          }
          lede="Everything your team needs to capture context, generate strategy, and run approvals with consistent quality."
        />

        <div className="mt-[44px] grid gap-[12px] md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, idx) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.35, delay: 0.06 + idx * 0.04 }}
            >
              <LandingCard className="glass-card-hover card-lift p-[22px] md:p-[26px] h-full">
                <div className="flex items-start gap-[12px]">
                  <div className="h-10 w-10 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-foreground/90" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">{f.title}</div>
                    <p className="mt-[8px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                      {f.body}
                    </p>
                  </div>
                </div>
              </LandingCard>
            </motion.div>
          ))}
        </div>
      </LandingContainer>
    </motion.section>
  );
}
