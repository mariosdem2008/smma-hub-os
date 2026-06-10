import React, { useState } from "react";
import { motion, useInView } from "framer-motion";
import { Calculator, Clock, TrendingUp, UserMinus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ROICalculatorModal from "@/components/modals/ROICalculator";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const smoothEase = [0.22, 1, 0.36, 1] as const;

const LEVERS = [
  {
    icon: Clock,
    title: "Time reclaimed",
    body: "Reduce manual strategy work, context hunting, and rewrite cycles so your team can focus on higher-leverage work.",
  },
  {
    icon: UserMinus,
    title: "Hiring avoided",
    body: "Systemize what your best people do so scaling does not require linear headcount growth.",
  },
  {
    icon: TrendingUp,
    title: "Capacity unlocked",
    body: "Open delivery bandwidth so you can take on more clients without sacrificing quality.",
  },
];

export default function ROI() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sectionRef = useSectionTracking("ROI");
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.75, ease: smoothEase }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={Sparkles}>ROI</Pill>}
          title={
            <>
              Estimate the upside
              <span className="block text-gradient-premium">with your numbers.</span>
            </>
          }
          lede="Every agency is different. Use the calculator to model a conservative estimate based on your client load, time, and economics."
        />

        <div className="mt-[44px] grid gap-[12px] md:grid-cols-3">
          {LEVERS.map((lever, idx) => (
            <motion.div
              key={lever.title}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.65, delay: 0.12 + idx * 0.08, ease: smoothEase }}
            >
              <LandingCard className="glass-card-hover card-lift p-[22px] md:p-[26px] h-full">
                <div className="flex items-start gap-[12px]">
                  <div className="h-10 w-10 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center">
                    <lever.icon className="h-5 w-5 text-foreground/90" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">{lever.title}</div>
                    <p className="mt-[8px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                      {lever.body}
                    </p>
                  </div>
                </div>
              </LandingCard>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.34, ease: smoothEase }}
          className="mt-[22px] mx-auto max-w-3xl"
        >
          <LandingCard className="gradient-border-animated p-[22px] md:p-[26px] flex flex-col md:flex-row md:items-center md:justify-between gap-[14px]">
            <div className="flex items-start gap-[12px]">
              <div className="h-10 w-10 rounded-xl bg-brand-primary/15 border border-white/10 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight text-foreground">ROI calculator</div>
                <div className="mt-[4px] text-sm text-text-muted">
                  Adjust assumptions and see an estimated monthly and annual impact.
                </div>
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => setIsModalOpen(true)}
              className="btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Open calculator
            </Button>
          </LandingCard>
        </motion.div>
      </LandingContainer>

      <ROICalculatorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </motion.section>
  );
}
