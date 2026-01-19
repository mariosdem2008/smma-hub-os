import React from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from 'lucide-react';
import { useSectionTracking } from '@/hooks/useSectionTracking';

const FAQS = [
  {
    q: "How long does setup take?",
    a: "2-4 weeks from kickoff to full deployment. Week 1: We capture your Agency Brain (SOPs, tone, strategies). Weeks 2-3: We onboard your first 3-5 clients and refine outputs. Week 4: You're live and generating strategies on demand.",
  },
  {
    q: "What if my agency's process is unique?",
    a: "That's exactly why SMMAHUB exists. Generic AI can't handle your unique SOPs—SMMAHUB is built to encode them. If you've documented your process (even loosely), we can train the AI on it.",
  },
  {
    q: "Does SMMAHUB replace my team?",
    a: "No. SMMAHUB replaces repetitive work (intake summaries, first-draft strategies, content briefs). Your team focuses on creative direction, client relationships, and approvals. Think of it as amplifying your best strategist, not replacing them.",
  },
  {
    q: "How accurate are the AI outputs?",
    a: "After a 30-day training period (where you review and refine outputs), pilot agencies report 95% first-draft approval rates. The AI learns from every revision, so accuracy improves over time.",
  },
  {
    q: "Can I export the data?",
    a: "Yes. You own all Client Brains, strategies, and content drafts. Export anytime as PDFs, CSVs, or via API. If you leave SMMAHUB, you take your data with you.",
  },
  {
    q: "What if my client changes their goals mid-month?",
    a: "Update the Client Brain in 2 minutes. The AI instantly adapts future outputs to the new goals. No need to re-explain context or re-train the system.",
  },
  {
    q: "Is my client data secure?",
    a: "Yes. SMMAHUB is SOC 2 Type II compliant and GDPR-ready. All data is encrypted at rest and in transit. We never train AI models on your proprietary data.",
  },
  {
    q: "What's the difference between SMMAHUB and ChatGPT + Notion?",
    a: "ChatGPT has no memory—every prompt starts from scratch. Notion requires manual copying/pasting. SMMAHUB automatically combines your Agency Brain + each Client Brain to generate on-brand, client-specific outputs in one click. It's the difference between a tool and a system.",
  },
  {
    q: "What if I need custom integrations?",
    a: "SMMAHUB integrates with common tools (Asana, ClickUp, Notion, Google Drive) out of the box. For custom integrations (e.g., your proprietary CRM), we offer API access on enterprise plans.",
  },
  {
    q: "What happens if I outgrow SMMAHUB?",
    a: "Our pricing scales with you—there's no ceiling. Agencies managing 5 clients pay less than agencies managing 50 clients. If you hit 100+ clients, we'll work with you on custom enterprise pricing.",
  },
];

const FAQ = () => {
  const sectionRef = useSectionTracking('FAQ');
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const handleAccordionChange = (value: string) => {
    if (value) {
      const faqIndex = parseInt(value.replace('item-', ''));
      console.log(`FAQ Interaction: Opened "${FAQS[faqIndex]?.q}"`);
    }
  };

  return (
    <motion.section
      id="faq"
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
            <HelpCircle className="w-4 h-4 text-brand-primary icon-glow" />
            <span className="text-small-text font-medium tracking-small-text text-brand-primary">FAQ</span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
            Frequently Asked Questions
          </h2>

          {/* Subheadline */}
          <p className="mt-24 mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
            Common questions answered—setup takes 2-4 weeks, we don't replace your team (we amplify them), and you own all your data.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-64 mx-auto max-w-3xl"
        >
          <Accordion
            type="single"
            collapsible
            className="w-full space-y-12"
            onValueChange={handleAccordionChange}
          >
            {FAQS.map((faq, i) => (
              <AccordionItem
                value={`item-${i}`}
                key={i}
                className="accordion-landing rounded-md px-24 border-0 glass-card"
              >
                <AccordionTrigger
                  aria-controls={`faq-content-${i}`}
                  className="text-left text-foreground hover:text-brand-primary py-20 hover:no-underline text-body-mobile md:text-body-desktop font-medium focus-ring"
                >
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent
                  id={`faq-content-${i}`}
                  className="text-text-secondary leading-body text-body-mobile md:text-body-desktop pb-20"
                >
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default FAQ;
