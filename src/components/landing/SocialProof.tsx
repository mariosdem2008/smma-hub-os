import React from "react";
import { motion, useInView } from "framer-motion";
import { Shield, Sparkles, Users } from "lucide-react";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { LandingCard, LandingContainer } from "./LandingPrimitives";

const PROOF = [
  {
    icon: Users,
    title: "Agency-native workflow",
    description: "Structured intake, handoffs, approvals, and iteration - in one place.",
  },
  {
    icon: Sparkles,
    title: "SOP-driven drafts",
    description: "Outputs start from your standards so quality stays consistent as you scale.",
  },
  {
    icon: Shield,
    title: "Security baseline",
    description: "Encryption in transit + at rest, with tenant isolation built into the platform.",
  },
];

export default function SocialProof() {
  const sectionRef = useSectionTracking("Social Proof");
  const isInView = useInView(sectionRef, { once: true, amount: 0.5 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.7 }}
      className="section-sm lp-section"
    >
      <div className="absolute top-0 left-0 right-0 section-divider" />
      <LandingContainer>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-[12px] md:grid-cols-3">
            {PROOF.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.1 + idx * 0.07, ease: [0.22, 1, 0.36, 1] }}
              >
                <LandingCard className="glass-card-hover card-lift p-[18px] md:p-[20px] h-full">
                  <div className="flex items-start gap-[12px]">
                    <div className="h-10 w-10 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-foreground/90" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold tracking-tight text-foreground">{item.title}</div>
                      <div className="mt-[6px] text-sm text-text-muted leading-body">{item.description}</div>
                    </div>
                  </div>
                </LandingCard>
              </motion.div>
            ))}
          </div>
        </div>
      </LandingContainer>
      <div className="absolute bottom-0 left-0 right-0 section-divider" />
    </motion.section>
  );
}
