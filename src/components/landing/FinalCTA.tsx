import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Sparkles, Check } from 'lucide-react';
import { useSectionTracking } from '@/hooks/useSectionTracking';

const CAL_LINK = "https://cal.com/SMMAHUB/fit";
const LOOM_LINK = "https://loom.com/share/LOOM_ID";

const TRUST_INDICATORS = [
  "No credit card required",
  "60-day ROI guarantee",
  "SOC 2 Type II compliant",
];

const FinalCTA = () => {
  const sectionRef = useSectionTracking('Final CTA');
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-lg relative overflow-hidden"
    >
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative overflow-hidden"
        >
          {/* Background with gradient */}
          <div className="glass-card gradient-border-animated rounded-md p-32 md:p-64 text-center relative">
            {/* Background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary/15 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/15 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="inline-flex items-center gap-2 badge-gradient-border mb-24"
              >
                <Sparkles className="w-4 h-4 text-success icon-glow" />
                <span className="text-small-text font-medium tracking-small-text text-success">Start Scaling Today</span>
              </motion.div>

              {/* Headline */}
              <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline text-gradient-premium">
                Ready to Scale Without Hiring?
              </h2>

              {/* Subheadline */}
              <p className="mt-24 mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                Book a free Strategy Audit to see your custom ROI. We'll analyze your workflow, estimate your time savings, and show you exactly how SMMAHUB fits your agency.
              </p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="mt-48 flex flex-col sm:flex-row justify-center gap-16"
              >
                <Button
                  asChild
                  size="lg"
                  className="btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text"
                >
                  <a href={CAL_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-8">
                    Book Your Strategy Audit (Free)
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="btn-secondary-enhanced group tracking-cta-text"
                >
                  <a href={LOOM_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-8">
                    <Play className="w-4 h-4" />
                    Watch 6-Min Demo
                  </a>
                </Button>
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.7 }}
                className="mt-48 flex flex-wrap justify-center gap-24 md:gap-32"
              >
                {TRUST_INDICATORS.map((indicator) => (
                  <span key={indicator} className="flex items-center gap-8 text-small-text text-text-secondary">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 flex-shrink-0">
                      <Check className="h-3 w-3 text-success" />
                    </span>
                    {indicator}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default FinalCTA;
