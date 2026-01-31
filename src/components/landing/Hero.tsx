import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import { Check, Brain, Users, Sparkles, Zap, Play } from "lucide-react";
import { Button } from '../ui/button.tsx';

const CAL_LINK = "https://cal.com/SMMAHUB/fit";
const LOOM_LINK = "https://loom.com/share/LOOM_ID";

const HERO_BULLETS = [
  "Save 15-20 hours per client monthly (strategy + execution work)",
  "Onboard clients in 10 minutes (auto-generated intake + brand decks)",
  "Maintain SOP consistency across 10, 20, or 50+ clients—no variance",
];

// Animated counter component for stats
const AnimatedStat = ({ value, suffix }: { value: number; suffix: string }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, value, { duration: 1.5, delay: 1.5, ease: "easeOut" });
      return controls.stop;
    }
  }, [isInView, value, count]);

  return (
    <span ref={ref} className="text-lg font-bold">
      <motion.span>{rounded}</motion.span>{suffix}
    </span>
  );
};

const Hero = () => {
  return (
    <header className="relative overflow-hidden landing-bg-mesh noise-overlay">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb-1 top-[-200px] left-[-100px]" />
        <div className="orb-2 top-[100px] right-[-150px]" />
        <div className="orb-3 bottom-[-100px] left-[30%]" />
      </div>

      <div className="container mx-auto px-[4px] py-[160px] md:py-[160px] relative z-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-[80px] lg:grid-cols-2 lg:items-center">
            {/* Left Column - Message */}
            <div>
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="inline-flex items-center gap-2 badge-gradient-border mb-[24px]"
              >
                <Sparkles className="w-4 h-4 text-brand-primary icon-glow" />
                <span className="text-small-text font-medium tracking-small-text text-brand-primary">For Growth-Stage Agencies</span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-hero-headline-mobile md:text-hero-headline-desktop font-semibold leading-hero-headline tracking-hero-headline text-gradient-premium"
              >
                Scale to 2X Your Clients Without Hiring
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
                className="mt-[16px] max-w-prose-landing text-subheadline-mobile md:text-subheadline-desktop text-text-secondary leading-subheadline tracking-subheadline"
              >
                Encode your SOPs once. Your team produces on-brand strategies for every client—in minutes, not hours. No hiring. No training cycles. Just predictable scale.
              </motion.p>

              {/* Bullets */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.1,
                      delayChildren: 0.8,
                    },
                  },
                }}
                className="mt-[32px] space-y-[16px]"
              >
                {HERO_BULLETS.map((bullet) => (
                  <motion.div
                    key={bullet}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                    }}
                    className="flex items-start gap-[12px] text-body-mobile md:text-body-desktop text-text-secondary leading-body"
                  >
                    <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/20 flex-shrink-0">
                      <Check className="h-3 w-3 text-brand-primary" />
                    </div>
                    <span>{bullet}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 1.1 }}
                className="mt-[48px] flex flex-col sm:flex-row gap-[16px]"
              >
                <Button
                  asChild
                  size="lg"
                  className="btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text"
                >
                  <a href={CAL_LINK} target="_blank" rel="noreferrer">
                    Book Your Strategy Audit (Free)
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="btn-secondary-enhanced group tracking-cta-text"
                >
                  <a href={LOOM_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Watch 6-Min Demo
                  </a>
                </Button>
              </motion.div>

              {/* Social Proof Line */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1.3 }}
                className="mt-[32px] text-small-text text-text-muted leading-small-text tracking-small-text"
              >
                <span className="text-brand-primary font-semibold">68% faster</span> strategy production. Agencies across 12 countries use SMMAHUB to manage 500+ clients without scaling headcount.
              </motion.p>
            </div>

            {/* Right Column - Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.3 }}
              className="relative"
            >
              <div className="preview-window-enhanced rounded-lg overflow-hidden">
                {/* Window header */}
                <div className="flex items-center gap-2 px-[4px] py-3 border-b border-white/5">
                  <div className="window-dots">
                    <div className="window-dot window-dot-red" />
                    <div className="window-dot window-dot-yellow" />
                    <div className="window-dot window-dot-green" />
                  </div>
                  <span className="ml-2 text-xs text-text-muted">SMMAHUB Dashboard</span>
                </div>

                {/* Dashboard content */}
                <div className="p-[24px] space-y-[16px]">
                  {/* Dual Brain visualization */}
                  <div className="grid grid-cols-2 gap-[16px]">
                    <div className="glass-card rounded-lg p-[16px]">
                      <div className="flex items-center gap-[8px] mb-[12px]">
                        <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center brain-core">
                          <Brain className="w-4 h-4 text-brand-primary" />
                        </div>
                        <span className="text-sm font-medium">Agency Brain</span>
                      </div>
                      <div className="space-y-[8px]">
                        <motion.div
                          className="h-2 bg-brand-primary/30 rounded-full progress-animated"
                          style={{ '--progress': '100%' } as React.CSSProperties}
                        />
                        <motion.div
                          className="h-2 bg-brand-primary/20 rounded-full progress-animated"
                          style={{ '--progress': '80%' } as React.CSSProperties}
                        />
                        <motion.div
                          className="h-2 bg-brand-primary/10 rounded-full progress-animated"
                          style={{ '--progress': '60%' } as React.CSSProperties}
                        />
                      </div>
                    </div>

                    <div className="glass-card rounded-lg p-[16px]">
                      <div className="flex items-center gap-[8px] mb-[12px]">
                        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center brain-core">
                          <Users className="w-4 h-4 text-accent" />
                        </div>
                        <span className="text-sm font-medium">Client Brain</span>
                      </div>
                      <div className="space-y-[8px]">
                        <motion.div
                          className="h-2 bg-accent/30 rounded-full progress-animated"
                          style={{ '--progress': '100%' } as React.CSSProperties}
                        />
                        <motion.div
                          className="h-2 bg-accent/20 rounded-full progress-animated"
                          style={{ '--progress': '75%' } as React.CSSProperties}
                        />
                        <motion.div
                          className="h-2 bg-accent/10 rounded-full progress-animated"
                          style={{ '--progress': '50%' } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Strategy output preview */}
                  <div className="glass-card rounded-lg p-[16px]">
                    <div className="flex items-center gap-[8px] mb-[12px]">
                      <div className="w-8 h-8 rounded-lg bg-gradient-premium flex items-center justify-center">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium">Strategy Output</span>
                      <span className="ml-auto text-xs text-success px-[8px] py-[4px] bg-success/10 rounded-full pulse-glow-green">Ready</span>
                    </div>
                    <div className="space-y-[8px]">
                      <div className="h-2 bg-white/10 rounded-full w-full" />
                      <div className="h-2 bg-white/10 rounded-full w-11/12" />
                      <div className="h-2 bg-white/10 rounded-full w-4/5" />
                      <div className="h-2 bg-white/10 rounded-full w-[90%]" />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-[12px]">
                    <div className="text-center p-[12px] rounded-lg bg-white/5">
                      <div className="text-brand-primary">
                        <AnimatedStat value={68} suffix="%" />
                      </div>
                      <div className="text-xs text-text-muted mt-[4px]">Faster</div>
                    </div>
                    <div className="text-center p-[12px] rounded-lg bg-white/5">
                      <div className="text-accent">
                        <AnimatedStat value={18} suffix="h" />
                      </div>
                      <div className="text-xs text-text-muted mt-[4px]">Saved/Client</div>
                    </div>
                    <div className="text-center p-[12px] rounded-lg bg-white/5">
                      <div className="text-success">
                        <AnimatedStat value={95} suffix="%" />
                      </div>
                      <div className="text-xs text-text-muted mt-[4px]">First Pass</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Hero;
