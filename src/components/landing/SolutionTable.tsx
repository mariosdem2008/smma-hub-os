import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Check, X, ArrowDown, Lightbulb } from 'lucide-react';
import { useSectionTracking } from '@/hooks/useSectionTracking';

const COMPARISON_DATA = [
  {
    feature: 'Setup Time',
    strategist: '4-8 weeks',
    chatgpt: 'Minutes (every time)',
    smmahub: '2-4 hours (one-time)',
  },
  {
    feature: 'Consistency',
    strategist: 'Varies by person',
    chatgpt: 'None (no memory)',
    smmahub: 'SOP-perfect every time',
  },
  {
    feature: 'Monthly Cost',
    strategist: '$5k+/month',
    chatgpt: '$20/month (+ your time)',
    smmahub: 'ROI-positive',
  },
  {
    feature: 'Scalability',
    strategist: 'Linear (hire per 3 clients)',
    chatgpt: 'Manual & repetitive',
    smmahub: 'Exponential',
  },
  {
    feature: 'Client-Specificity',
    strategist: 'High (but manual)',
    chatgpt: 'Low (generic output)',
    smmahub: 'High (dual-brain)',
  },
];

const SolutionTable = () => {
  const sectionRef = useSectionTracking('Solution Table');
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md"
    >
      <div className="container mx-auto px-4">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 badge-gradient-border mb-24"
          >
            <Lightbulb className="w-4 h-4 text-brand-primary icon-glow" />
            <span className="text-small-text font-medium tracking-small-text text-brand-primary">The Alternative</span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
            Stop Training People.<br className="hidden md:block" />
            <span className="text-gradient-premium">Start Training the System.</span>
          </h2>

          {/* Subheadline */}
          <p className="mt-24 mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
            SMMAHUB isn't a content generator—it's your agency's operating system. It replaces hiring + training cycles with a system that learns your SOPs once and applies them forever.
          </p>
        </div>

        {/* Desktop Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-48 hidden md:block"
        >
          <div className="glass-card rounded-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-24 py-16 text-left text-small-text font-medium text-text-muted tracking-uppercase">
                    Feature
                  </th>
                  <th className="px-24 py-16 text-left text-small-text font-medium text-text-muted tracking-uppercase">
                    Hiring a Strategist
                  </th>
                  <th className="px-24 py-16 text-left text-small-text font-medium text-text-muted tracking-uppercase">
                    Using ChatGPT
                  </th>
                  <th className="px-24 py-16 text-left text-small-text font-medium text-brand-primary tracking-uppercase comparison-highlight">
                    SMMAHUB
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {COMPARISON_DATA.map((row, index) => (
                  <motion.tr
                    key={row.feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                    className="table-row-hover transition-colors"
                  >
                    <td className="px-24 py-16 text-body-desktop font-medium text-foreground">
                      {row.feature}
                    </td>
                    <td className="px-24 py-16 text-body-desktop text-text-secondary">
                      <div className="flex items-center gap-8">
                        <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                        {row.strategist}
                      </div>
                    </td>
                    <td className="px-24 py-16 text-body-desktop text-text-secondary">
                      <div className="flex items-center gap-8">
                        <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                        {row.chatgpt}
                      </div>
                    </td>
                    <td className="px-24 py-16 text-body-desktop comparison-highlight">
                      <div className="flex items-center gap-8">
                        <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-success" />
                        </div>
                        <span className="text-foreground font-medium">{row.smmahub}</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Mobile Cards */}
        <div className="mt-48 md:hidden space-y-16">
          {COMPARISON_DATA.map((row, index) => (
            <motion.div
              key={row.feature}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
              className="glass-card glass-card-hover rounded-md p-24"
            >
              <h4 className="font-semibold text-foreground mb-16">{row.feature}</h4>
              <div className="space-y-12 text-body-mobile">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Strategist:</span>
                  <span className="text-red-400">{row.strategist}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">ChatGPT:</span>
                  <span className="text-red-400">{row.chatgpt}</span>
                </div>
                <div className="flex justify-between items-center pt-12 border-t border-white/10">
                  <span className="text-brand-primary font-medium">SMMAHUB:</span>
                  <span className="text-success font-medium">{row.smmahub}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-48 text-center"
        >
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-8 text-brand-primary font-semibold hover:text-brand-primary/80 transition-colors group focus-ring"
          >
            See How It Works
            <ArrowDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
          </a>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default SolutionTable;
