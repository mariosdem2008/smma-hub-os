import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import ROICalculatorModal from '@/components/modals/ROICalculator';
import { useSectionTracking } from '@/hooks/useSectionTracking';
import { Calculator, Clock, UserMinus, TrendingUp } from 'lucide-react';

const ROI_CARDS = [
  {
    title: "Time Reclaimed",
    icon: Clock,
    formula: "18 hours/client/month × $75/hour (your loaded cost) × 8 clients =",
    value: 10800,
    prefix: "$",
    suffix: "/month reclaimed",
    description: "Use these hours for sales, client relationships, or higher-margin work.",
    color: "brand-primary",
  },
  {
    title: "Hiring Avoided",
    icon: UserMinus,
    formula: "1 mid-level strategist salary ($60K/year = $5,000/month) vs. SMMAHUB =",
    value: 4000,
    prefix: "$",
    suffix: "+ saved monthly",
    description: "Plus: no recruiting fees, no onboarding time, no turnover risk.",
    color: "accent",
  },
  {
    title: "Revenue Unlocked",
    icon: TrendingUp,
    formula: "Your team handles 4 more clients (no new hires) × $2,000 MRR/client =",
    value: 8000,
    prefix: "$",
    suffix: "/month new revenue",
    description: "With SMMAHUB, your bottleneck shifts from delivery to sales. That's a good problem.",
    color: "success",
  },
];

interface OdometerProps {
  value: number;
  prefix: string;
  suffix: string;
}

const Odometer = ({ value, prefix, suffix }: OdometerProps) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.6 });

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, value, { duration: 1.2, ease: "easeOut" });
      return controls.stop;
    }
  }, [isInView, value, count]);

  return (
    <span ref={ref} className="block">
      <span className="text-3xl md:text-4xl font-bold text-gradient-premium stat-number">
        {prefix}
        <motion.span>{rounded}</motion.span>
      </span>
      <span className="text-body-mobile md:text-body-desktop text-text-muted ml-2">{suffix}</span>
    </span>
  );
};

const ROI = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sectionRef = useSectionTracking('ROI');
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
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-success/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 badge-gradient-border mb-24"
          >
            <Calculator className="w-4 h-4 text-brand-primary icon-glow" />
            <span className="text-small-text font-medium tracking-small-text text-brand-primary">The Math</span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
            The Math: SMMAHUB ROI<br className="hidden md:block" />
            <span className="text-gradient-premium">in Month One</span>
          </h2>

          {/* Subheadline */}
          <p className="mt-24 mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
            Here's the calculation agencies are using to justify the investment.
          </p>
        </div>

        {/* ROI Cards */}
        <div className="mt-64 grid gap-24 md:grid-cols-3">
          {ROI_CARDS.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              className="glass-card glass-card-hover card-lift rounded-md p-32 md:p-40"
            >
              <div className="flex items-center gap-12 mb-16">
                <div className={`w-10 h-10 rounded-lg bg-${card.color}/20 flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 text-${card.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{card.title}</h3>
              </div>

              <p className="text-small-text text-text-muted leading-small-text mb-24">{card.formula}</p>

              <div className="mb-16">
                <Odometer value={card.value} prefix={card.prefix} suffix={card.suffix} />
              </div>

              <p className="text-small-text text-text-secondary italic leading-small-text">{card.description}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA - Enhanced ROI Calculator Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-64"
        >
          <div className="glass-card gradient-border-animated rounded-md p-32 md:p-40 max-w-2xl mx-auto text-center">
            <div className="flex items-center justify-center gap-8 mb-16">
              <Calculator className="w-5 h-5 text-brand-primary icon-glow" />
              <span className="text-body-desktop font-semibold text-foreground">
                See Your Exact Numbers
              </span>
            </div>
            <p className="text-body-mobile md:text-body-desktop text-text-secondary leading-body mb-24">
              These numbers are based on averages. Calculate your{' '}
              <span className="text-brand-primary font-medium">personalized ROI</span>{' '}
              based on your agency's specific metrics.
            </p>
            <Button
              size="lg"
              onClick={() => setIsModalOpen(true)}
              className="btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculate Your Custom ROI
            </Button>
          </div>
        </motion.div>
      </div>

      <ROICalculatorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </motion.section>
  );
};

export default ROI;
