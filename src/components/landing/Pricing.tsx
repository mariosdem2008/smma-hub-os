import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, Shield, ArrowRight, CreditCard, Eye } from 'lucide-react';
import { useSectionTracking } from '@/hooks/useSectionTracking';

const CAL_LINK = "https://cal.com/SMMAHUB/fit";

const WHATS_INCLUDED = [
  "Agency Brain setup (your SOPs, tone, strategies encoded)",
  "Unlimited Client Brains (every client gets a dedicated profile)",
  "Strategy generation (monthly themes, briefs, content angles)",
  "Approval workflows (client portal + feedback loops)",
  "Weekly performance reports (auto-generated summaries)",
  "Dedicated onboarding (2-4 weeks to full deployment)",
];

const Pricing = () => {
  const sectionRef = useSectionTracking('Pricing');
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      id="pricing"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-primary/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-[4px] relative z-10">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 badge-gradient-border mb-[24px]"
          >
            <CreditCard className="w-4 h-4 text-brand-primary icon-glow" />
            <span className="text-small-text font-medium tracking-small-text text-brand-primary">Pricing</span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
            Pricing That Scales With Your Agency<br className="hidden md:block" />
            <span className="text-gradient-premium">(Not Against It)</span>
          </h2>

          {/* Subheadline */}
          <p className="mt-[24px] mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
            SMMAHUB pricing scales with your client count. Whether you manage 5 clients or 50, you pay based on what you use—not a one-size-fits-all tier.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-[64px] mx-auto max-w-5xl"
        >
          <div className="glass-card gradient-border-animated rounded-md p-[32px] md:p-[48px]">
            <div className="grid gap-[48px] lg:grid-cols-2">
              {/* What's Included */}
              <div>
                <h3 className="text-xl font-semibold mb-[24px] text-foreground">What's Included (All Plans)</h3>
                <ul className="space-y-[16px]">
                  {WHATS_INCLUDED.map((item, index) => (
                    <motion.li
                      key={item}
                      initial={{ opacity: 0, x: -10 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                      className="flex items-start gap-[12px] text-text-secondary"
                    >
                      <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-success/20 flex-shrink-0">
                        <Check className="h-3 w-3 text-success" />
                      </div>
                      <span className="leading-body text-body-mobile md:text-body-desktop">{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* ROI Guarantee & CTA */}
              <div className="glass-card rounded-md p-[32px] md:p-[40px] bg-white/5">
                <div className="flex items-center gap-[12px] mb-[16px]">
                  <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-success" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">ROI Guarantee</h3>
                </div>

                <p className="text-text-secondary leading-body text-body-mobile md:text-body-desktop">
                  If SMMAHUB doesn't save you 10+ hours per client in your first 60 days, we'll refund your investment. No questions asked.
                </p>

                <div className="mt-[32px] pt-[24px] border-t border-white/10">
                  <h4 className="font-semibold text-foreground">Not Sure If It's Right For You?</h4>
                  <p className="mt-[12px] text-text-secondary leading-body text-body-mobile md:text-body-desktop">
                    Start with a free Strategy Audit. We'll analyze your current workflow, estimate your time savings, and calculate your exact ROI. No obligation.
                  </p>

                  <div className="mt-[24px] flex flex-col gap-[16px]">
                    <Button
                      asChild
                      size="lg"
                      className="w-full btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text"
                    >
                      <a href={CAL_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-[8px]">
                        Book Your Strategy Audit (Free)
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="w-full btn-secondary-enhanced tracking-cta-text"
                    >
                      <a href="#" className="inline-flex items-center justify-center gap-[8px]">
                        <Eye className="w-4 h-4" />
                        View Sample Pricing
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default Pricing;
