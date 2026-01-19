import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Brain, Users, FileText, Target, Palette, BarChart3, BookOpen, Sparkles, ArrowRight, Play } from "lucide-react";
import { useSectionTracking } from '@/hooks/useSectionTracking';

const LOOM_LINK = "https://loom.com/share/LOOM_ID";

const AGENCY_BRAIN_INPUTS = [
  { icon: BookOpen, label: "SOPs & Processes" },
  { icon: Palette, label: "Tone Guides" },
  { icon: FileText, label: "Past Strategies" },
  { icon: Target, label: "Quality Standards" },
];

const CLIENT_BRAIN_INPUTS = [
  { icon: Target, label: "Goals & KPIs" },
  { icon: Palette, label: "Brand Voice" },
  { icon: Users, label: "Audience Data" },
  { icon: BarChart3, label: "Past Performance" },
];

const DualBrain = () => {
  const sectionRef = useSectionTracking('Dual Brain');
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 badge-gradient-border mb-24"
          >
            <Sparkles className="w-4 h-4 text-brand-primary icon-glow" />
            <span className="text-small-text font-medium tracking-small-text text-brand-primary">Proprietary Technology</span>
          </motion.div>

          {/* Headline - Math formula structure */}
          <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
            Your Agency Brain + Every Client Brain<br className="hidden md:block" />
            <span className="text-gradient-premium">= Always On-Brand</span>
          </h2>

          {/* Subheadline */}
          <p className="mt-16 text-subheadline-mobile md:text-subheadline-desktop text-text-secondary tracking-subheadline">
            Why SMMAHUB Isn't "Just Another AI Tool"
          </p>

          {/* Body copy */}
          <p className="mt-24 mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
            Generic AI tools (ChatGPT, Jasper, Copy.ai) have one fatal flaw: they have no memory. Every prompt starts from zero. You re-explain your SOPs, your client's brand voice, your quality bar—every. single. time.
          </p>
          <p className="mt-16 mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-foreground font-medium leading-body">
            SMMAHUB is different. It has two brains:
          </p>
        </div>

        {/* Dual Brain Visualization */}
        <div className="mt-64 grid gap-32 lg:grid-cols-2">
          {/* Agency Brain */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-card glass-card-hover card-lift rounded-md p-32 md:p-40 relative overflow-hidden group"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10">
              <div className="flex items-center gap-16 mb-24">
                <div className="w-14 h-14 rounded-xl bg-brand-primary/20 flex items-center justify-center brain-core">
                  <Brain className="w-7 h-7 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-foreground">Agency Brain</h3>
                  <p className="text-small-text text-text-muted tracking-small-text">Encoded once, applied forever</p>
                </div>
              </div>

              <p className="text-text-secondary mb-24 leading-body text-body-mobile md:text-body-desktop">
                Your SOPs, tone guides, successful strategies, and quality standards—captured once, applied to every client. The AI learns what "good" looks like for your agency.
              </p>

              <div className="grid grid-cols-2 gap-12">
                {AGENCY_BRAIN_INPUTS.map((input, index) => (
                  <motion.div
                    key={input.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                    className="flex items-center gap-8 p-12 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <input.icon className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span className="text-small-text text-foreground">{input.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Client Brain */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="glass-card glass-card-hover card-lift rounded-md p-32 md:p-40 relative overflow-hidden group"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative z-10">
              <div className="flex items-center gap-16 mb-24">
                <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center brain-core">
                  <Users className="w-7 h-7 text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-foreground">Client Brain</h3>
                  <p className="text-small-text text-text-muted tracking-small-text">Per-client context that persists</p>
                </div>
              </div>

              <p className="text-text-secondary mb-24 leading-body text-body-mobile md:text-body-desktop">
                Each client's goals, brand voice, audience demographics, past performance, and approval history. The AI remembers what works for Client A vs. Client B.
              </p>

              <div className="grid grid-cols-2 gap-12">
                {CLIENT_BRAIN_INPUTS.map((input, index) => (
                  <motion.div
                    key={input.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
                    className="flex items-center gap-8 p-12 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <input.icon className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-small-text text-foreground">{input.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Result - Value Prop Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-64 text-center"
        >
          <div className="glass-card gradient-border-animated inline-block rounded-md p-32 md:p-40">
            <p className="text-subheadline-mobile md:text-subheadline-desktop text-foreground max-w-2xl leading-subheadline">
              When you generate a strategy, SMMAHUB pulls from both brains. The result? Content that <span className="text-brand-primary font-semibold">sounds like your agency</span> and <span className="text-accent font-semibold">fits the specific client</span>—without you typing a 500-word prompt.
            </p>
          </div>

          <div className="mt-48">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="btn-secondary-enhanced group tracking-cta-text"
            >
              <a href={LOOM_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-8">
                <Play className="w-4 h-4" />
                See It In Action
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default DualBrain;
