import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Shield, Users, Zap } from 'lucide-react';
import { useSectionTracking } from '@/hooks/useSectionTracking';

const PROOF_CARDS = [
  {
    title: "Pilot Results",
    icon: Zap,
    value: "68% faster",
    metric: "strategy production",
    description: "Measured across 12 agencies in 60-day pilot (Sep-Nov 2025)",
    color: "brand-primary",
  },
  {
    title: "Built by Operators",
    icon: Users,
    value: "50+ clients",
    metric: "managed by founders",
    description: "We've felt your pain—and built the solution we wished existed",
    color: "accent",
  },
  {
    title: "Enterprise Security",
    icon: Shield,
    value: "SOC 2 Type II",
    metric: "GDPR-ready",
    description: "Your client data and SOPs are encrypted and never shared",
    color: "success",
  },
];

const SocialProof = () => {
  const sectionRef = useSectionTracking('Social Proof');
  const isInView = useInView(sectionRef, { once: true, amount: 0.5 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="section-sm relative"
    >
      {/* Subtle divider line */}
      <div className="absolute top-0 left-0 right-0 section-divider" />

      <div className="container mx-auto px-[4px]">
        {/* Refined social proof line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center text-body-mobile md:text-body-desktop text-text-secondary leading-body max-w-prose-landing mx-auto"
        >
          <span className="text-brand-primary font-semibold">68% faster</span> strategy production. Agencies across{' '}
          <span className="text-foreground font-medium">12 countries</span> use SMMAHUB to manage{' '}
          <span className="text-foreground font-medium">500+ clients</span> without scaling headcount.
        </motion.p>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.15,
              },
            },
            hidden: { opacity: 0 }
          }}
          className="mt-[48px] grid gap-[24px] md:grid-cols-3"
        >
          {PROOF_CARDS.map((card) => (
            <motion.div
              key={card.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
              className="glass-card glass-card-hover card-lift rounded-md p-[24px] md:p-[32px] text-center"
            >
              <div className={`w-12 h-12 rounded-xl bg-${card.color}/20 flex items-center justify-center mx-auto mb-[16px]`}>
                <card.icon className={`w-6 h-6 text-${card.color}`} />
              </div>
              <h3 className="text-small-text font-medium text-text-muted tracking-small-text uppercase mb-[8px]">
                {card.title}
              </h3>
              <p className="text-2xl md:text-3xl font-bold text-gradient-premium stat-number">
                {card.value}
              </p>
              <p className="text-body-mobile md:text-body-desktop text-foreground font-medium mt-[4px]">
                {card.metric}
              </p>
              <p className="mt-[12px] text-small-text text-text-muted leading-small-text">
                {card.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Subtle divider line */}
      <div className="absolute bottom-0 left-0 right-0 section-divider" />
    </motion.section>
  );
};

export default SocialProof;
