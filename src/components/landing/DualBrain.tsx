import React from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, BarChart3, BookOpen, Brain, Palette, Play, Sparkles, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const DEMO_LINK = marketing.demoUrl;

const AGENCY_LAYERS = [
  { icon: BookOpen, label: "SOPs & processes" },
  { icon: Palette, label: "Tone & brand standards" },
  { icon: Target, label: "Quality checklist" },
  { icon: Brain, label: "Approved playbooks" },
];

const CLIENT_LAYERS = [
  { icon: Target, label: "Goals & KPIs" },
  { icon: Palette, label: "Voice & positioning" },
  { icon: Users, label: "Audience & offers" },
  { icon: BarChart3, label: "Performance history" },
];

export default function DualBrain() {
  const sectionRef = useSectionTracking("Dual Brain");
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.75 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={Sparkles}>How it stays on-brand</Pill>}
          title={
            <>
              Two layers of memory.
              <span className="block text-gradient-premium">One consistent output.</span>
            </>
          }
          subtitle="Agency standards + per-client context"
          lede="SMMAHUB stores what makes your agency good, plus what makes each client unique. Every deliverable is generated from both - automatically."
        />

        <div className="mt-[56px] grid gap-[18px] lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.75, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <LandingCard className="glass-card-hover card-lift p-[28px] md:p-[34px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-transparent opacity-70" />
              <div className="relative">
                <div className="flex items-center gap-[14px]">
                  <div className="h-12 w-12 rounded-xl bg-brand-primary/20 flex items-center justify-center">
                    <Brain className="h-6 w-6 text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Agency layer</h3>
                    <p className="text-small-text text-text-muted tracking-small-text">Encoded once, applied everywhere</p>
                  </div>
                </div>

                <p className="mt-[14px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                  The non-negotiables: how you write, structure strategy, and run approvals.
                </p>

                <div className="mt-[18px] grid grid-cols-2 gap-[10px]">
                  {AGENCY_LAYERS.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-[8px] px-[12px] py-[10px] rounded-lg bg-white/5 border border-white/5"
                    >
                      <item.icon className="h-4 w-4 text-brand-primary shrink-0" />
                      <span className="text-small-text text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </LandingCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.75, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <LandingCard className="glass-card-hover card-lift p-[28px] md:p-[34px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-70" />
              <div className="relative">
                <div className="flex items-center gap-[14px]">
                  <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Client layer</h3>
                    <p className="text-small-text text-text-muted tracking-small-text">Persistent, per-client context</p>
                  </div>
                </div>

                <p className="mt-[14px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                  The inputs that change per account - captured once and reused.
                </p>

                <div className="mt-[18px] grid grid-cols-2 gap-[10px]">
                  {CLIENT_LAYERS.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-[8px] px-[12px] py-[10px] rounded-lg bg-white/5 border border-white/5"
                    >
                      <item.icon className="h-4 w-4 text-accent shrink-0" />
                      <span className="text-small-text text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </LandingCard>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="mt-[44px] text-center"
        >
          <LandingCard className="gradient-border-animated inline-block p-[26px] md:p-[32px]">
            <p className="text-subheadline-mobile md:text-subheadline-desktop text-foreground max-w-2xl leading-subheadline">
              Generate a strategy, brief, or approval-ready plan and SMMAHUB applies both layers - so the first draft is
              already aligned.
            </p>
          </LandingCard>

          {DEMO_LINK ? (
            <div className="mt-[22px]">
              <Button asChild variant="outline" size="lg" className="btn-secondary-enhanced group tracking-cta-text">
                <a
                  href={DEMO_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-[8px]"
                  onClick={() => track("cta_watch_demo_click", { location: "dual_brain" })}
                >
                  <Play className="w-4 h-4" />
                  See it in action
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
            </div>
          ) : null}
        </motion.div>
      </LandingContainer>
    </motion.section>
  );
}
