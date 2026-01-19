import React from 'react';
import { motion, useInView } from 'framer-motion';
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { useSectionTracking } from '@/hooks/useSectionTracking';

const ProblemSection = () => {
  const sectionRef = useSectionTracking('Problem Section');
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md relative overflow-hidden"
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-24"
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-small-text font-medium tracking-small-text text-red-400">The Constraint</span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
            Every 3 New Clients = 1 New Hire.<br className="hidden md:block" />
            <span className="text-red-400">Your Margins Can't Survive.</span>
          </h2>

          {/* Body copy */}
          <div className="mt-24 mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body space-y-24">
            <p>
              You're trapped in a linear scaling model. Revenue grows, but so does headcount. Onboarding takes 4-8 weeks. Quality varies by who's on the account. When a star strategist leaves, client knowledge walks out the door.
            </p>
            <p>
              You can't hire fast enough. You can't turn down new business. And you can't maintain consistency when every team member interprets your SOPs differently.
            </p>
            <p className="text-foreground font-medium">
              There's a better model.
            </p>
          </div>
        </div>

        {/* Comparison Cards */}
        <div className="mt-64 grid gap-32 md:grid-cols-2">
          {/* The Hiring Treadmill */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-card glass-card-hover rounded-md p-32 md:p-40 group graph-card-hiring"
          >
            <div className="flex items-center gap-12 mb-24">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">The Hiring Treadmill</h3>
            </div>

            {/* Visual graph representation */}
            <div className="relative h-48 mb-24">
              <div className="absolute inset-0 flex items-end justify-between gap-2 pb-32">
                {[30, 45, 55, 60, 63, 65, 66].map((height, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={isInView ? { scaleY: 1 } : {}}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                    className="flex-1 bg-gradient-to-t from-red-500/40 to-red-500/20 rounded-t bar-animated origin-bottom"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-text-muted">
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
                <span>25</span>
                <span>30</span>
                <span>35 clients</span>
              </div>
              {/* Y-axis label */}
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-text-muted whitespace-nowrap">
                Headcount
              </div>
              {/* Milestone markers */}
              <div className="milestone-marker absolute bottom-[45%] left-[14%] text-xs text-red-400">
                <span className="block w-2 h-2 rounded-full bg-red-400 mb-1" />
                New Hire
              </div>
            </div>

            <div className="space-y-12 pt-16 border-t border-white/10">
              <div className="flex items-center gap-8 text-sm text-text-secondary">
                <Users className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>Linear growth: 1 hire per 3 clients</span>
              </div>
              <div className="flex items-center gap-8 text-sm text-text-secondary">
                <DollarSign className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>Margins compress as headcount scales</span>
              </div>
              <div className="flex items-center gap-8 text-sm text-text-secondary">
                <Clock className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>4-8 weeks to onboard each hire</span>
              </div>
            </div>
          </motion.div>

          {/* The Scaling System */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="glass-card glass-card-hover rounded-md p-32 md:p-40 gradient-border-animated group graph-card-scaling"
          >
            <div className="flex items-center gap-12 mb-24">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">The Scaling System</h3>
            </div>

            {/* Visual graph representation */}
            <div className="relative h-48 mb-24">
              <div className="absolute inset-0 flex items-end justify-between gap-2 pb-32">
                {[20, 22, 24, 25, 26, 27, 27].map((height, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={isInView ? { scaleY: 1 } : {}}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                    className="flex-1 bg-gradient-to-t from-success/40 to-success/20 rounded-t bar-animated origin-bottom"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              {/* Revenue overlay line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={isInView ? { scaleX: 1 } : {}}
                transition={{ duration: 1, delay: 0.8 }}
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-brand-primary to-accent origin-left"
                style={{ bottom: '70%' }}
              />
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-text-muted">
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
                <span>25</span>
                <span>30</span>
                <span>35 clients</span>
              </div>
              {/* Milestone marker */}
              <div className="milestone-marker absolute bottom-[25%] left-[14%] text-xs text-success">
                <span className="block w-2 h-2 rounded-full bg-success mb-1" />
                SMMAHUB Setup
              </div>
            </div>

            <div className="space-y-12 pt-16 border-t border-white/10">
              <div className="flex items-center gap-8 text-sm text-text-secondary">
                <Users className="w-4 h-4 text-success flex-shrink-0" />
                <span>Same team handles 3x more clients</span>
              </div>
              <div className="flex items-center gap-8 text-sm text-text-secondary">
                <DollarSign className="w-4 h-4 text-success flex-shrink-0" />
                <span>Margins expand with SMMAHUB</span>
              </div>
              <div className="flex items-center gap-8 text-sm text-text-secondary">
                <Clock className="w-4 h-4 text-success flex-shrink-0" />
                <span>2-4 hours one-time setup</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default ProblemSection;
