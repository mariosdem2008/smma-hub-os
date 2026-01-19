import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { UploadCloud, UserPlus, FileText, ArrowRight, Cog } from 'lucide-react';
import { useSectionTracking } from '@/hooks/useSectionTracking';

const CAL_LINK = "https://cal.com/SMMAHUB/fit";

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Encode Your Agency Brain",
    description: "Upload your successful strategies, SOPs, and client approaches once. SMMAHUB learns how your agency thinks, writes, and delivers. This takes 2-4 hours (one-time setup).",
    icon: UploadCloud,
    color: "brand-primary",
  },
  {
    step: "02",
    title: "Onboard Each Client's Context",
    description: "For every new client, SMMAHUB runs a 10-minute guided intake. It captures their goals, brand voice, audience data, and past performance. The AI builds a \"Client Brain\" that persists forever—no knowledge walks out the door.",
    icon: UserPlus,
    color: "accent",
  },
  {
    step: "03",
    title: "Generate Strategies On Demand",
    description: "Need a monthly strategy? A content brief? A campaign plan? Click generate. SMMAHUB combines your Agency Brain + the Client Brain to produce on-brand, client-specific deliverables in minutes. Your team reviews, refines, and ships.",
    icon: FileText,
    color: "success",
  },
];

const HowItWorks = () => {
  const sectionRef = useSectionTracking('How It Works');
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      id="how-it-works"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md relative overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-primary/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 badge-gradient-border mb-24"
          >
            <Cog className="w-4 h-4 text-brand-primary icon-glow" />
            <span className="text-small-text font-medium tracking-small-text text-brand-primary">3 Simple Steps</span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
            3 Steps. One-Time Setup.<br className="hidden md:block" />
            <span className="text-gradient-premium">Infinite Scale.</span>
          </h2>

          {/* Subheadline */}
          <p className="mt-24 mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
            Capture what makes your agency successful, then let AI apply it consistently across all clients.
          </p>
        </div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.2,
              },
            },
            hidden: { opacity: 0 }
          }}
          className="mt-64 grid gap-24 lg:grid-cols-3"
        >
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <motion.div
              key={step.step}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
              className="relative group"
            >
              {/* Connecting line on desktop */}
              {index < HOW_IT_WORKS_STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-white/20 to-transparent z-0" style={{ width: 'calc(100% - 2rem)' }} />
              )}

              <div className="glass-card glass-card-hover card-lift rounded-md p-32 md:p-40 h-full relative z-10">
                {/* Step number badge */}
                <div className="absolute -top-4 -left-2 md:-left-4">
                  <div className="text-5xl md:text-6xl font-bold text-white/5">
                    {step.step}
                  </div>
                </div>

                <div className="flex items-center gap-16 mb-24">
                  <div className={`w-12 h-12 rounded-lg bg-${step.color}/20 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <step.icon className={`w-6 h-6 text-${step.color}`} />
                  </div>
                  <span className="text-small-text font-medium text-text-muted tracking-small-text">Step {step.step}</span>
                </div>

                <h3 className="text-xl font-semibold mb-16 text-foreground">{step.title}</h3>
                <p className="text-text-secondary leading-body text-body-mobile md:text-body-desktop">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-64 text-center"
        >
          <Button
            asChild
            size="lg"
            className="btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text"
          >
            <a href={CAL_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-8">
              Book Your Strategy Audit
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default HowItWorks;
