import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Check, Users, Lightbulb, Rocket, Box } from 'lucide-react';
import { useSectionTracking } from '@/hooks/useSectionTracking';

const FEATURE_BUCKETS = [
  {
    title: "Client Capture",
    icon: Users,
    color: "brand-primary",
    features: [
      "Auto-generated onboarding deck (brand summary, goals, audience)",
      "Guided intake forms (10-min client questionnaire)",
      "Client Brain summary (exportable, shareable with your team)",
      "Approval tracking (know which clients reviewed what, when)",
    ],
  },
  {
    title: "Strategy Engine",
    icon: Lightbulb,
    color: "accent",
    features: [
      "Monthly content themes (AI-generated, aligned with client goals)",
      "Content angles and campaign briefs (ready for team review)",
      "Strategy documents (formatted, branded, client-ready)",
      "Revision tracking (continuous learning from feedback)",
    ],
  },
  {
    title: "Execution Ready",
    icon: Rocket,
    color: "success",
    features: [
      "Content drafts (captions, scripts, post variations)",
      "Posting schedules (optimized by platform and client goals)",
      "Client approval portal (white-labeled, no logins required)",
      "Weekly reports (auto-generated performance summaries)",
    ],
  },
];

const Features = () => {
  const sectionRef = useSectionTracking('Features');
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <motion.section
      id="outputs"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md relative overflow-hidden"
    >
      {/* Background gradient */}
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
            <Box className="w-4 h-4 text-brand-primary icon-glow" />
            <span className="text-small-text font-medium tracking-small-text text-brand-primary">Complete Solution</span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
            Your Entire Client Lifecycle,<br className="hidden md:block" />
            <span className="text-gradient-premium">Automated.</span>
          </h2>

          {/* Subheadline */}
          <p className="mt-[24px] mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
            SMMAHUB handles everything from client onboarding to strategy generation to approval workflows.
          </p>
        </div>

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
          className="mt-[64px] grid gap-[24px] lg:grid-cols-3"
        >
          {FEATURE_BUCKETS.map((bucket, bucketIndex) => (
            <motion.div
              key={bucket.title}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
              className="glass-card glass-card-hover card-lift rounded-md p-[32px] md:p-[40px] h-full"
            >
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className={`w-12 h-12 rounded-xl bg-${bucket.color}/20 flex items-center justify-center`}>
                  <bucket.icon className={`w-6 h-6 text-${bucket.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{bucket.title}</h3>
              </div>

              <ul className="space-y-[16px]">
                {bucket.features.map((feature, index) => (
                  <motion.li
                    key={feature}
                    initial={{ opacity: 0, x: -10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.3, delay: 0.4 + bucketIndex * 0.15 + index * 0.1 }}
                    className="flex items-start gap-[12px] text-text-secondary"
                  >
                    <div className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-${bucket.color}/20 flex-shrink-0`}>
                      <Check className={`h-3 w-3 text-${bucket.color}`} />
                    </div>
                    <span className="leading-body text-body-mobile md:text-body-desktop">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};

export default Features;
