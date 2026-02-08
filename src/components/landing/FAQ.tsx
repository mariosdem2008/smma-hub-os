import React from "react";
import { motion, useInView } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { track } from "@/lib/analytics";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const FAQS = [
  {
    q: "How long does setup take?",
    a: "It depends on your workflow and how much you want to systemize. Most teams get useful drafts quickly, then refine standards over the following weeks.",
  },
  {
    q: "What if our process is unique?",
    a: "That is the point. SMMAHUB is designed to encode your SOPs and standards so outputs match how your agency actually works.",
  },
  {
    q: "Does SMMAHUB replace my team?",
    a: "No. SMMAHUB drafts and systemizes repetitive work. Your team stays in control of quality, approvals, and client communication.",
  },
  {
    q: "How accurate are the outputs?",
    a: "They improve as you review and refine. SMMAHUB is built to generate strong first drafts from approved inputs, with your team as the final quality gate.",
  },
  {
    q: "Is client data secure?",
    a: "We use encryption in transit and at rest and enforce tenant isolation. We do not train models on your proprietary data.",
  },
  {
    q: "Can I export data?",
    a: "Yes. You own your strategies and drafts. Export anytime.",
  },
];

export default function FAQ() {
  const sectionRef = useSectionTracking("FAQ");
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const handleAccordionChange = (value: string) => {
    if (!value) return;
    const faqIndex = Number(value.replace("item-", ""));
    track("landing_faq_open", { question: FAQS[faqIndex]?.q });
  };

  return (
    <motion.section
      id="faq"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.4 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={HelpCircle}>FAQ</Pill>}
          title={
            <>
              Common questions,
              <span className="block text-gradient-premium">clear answers.</span>
            </>
          }
          lede="Setup varies by agency. Your team stays in control. You own your data."
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="mt-[44px] mx-auto max-w-3xl"
        >
          <LandingCard className="p-[10px] md:p-[12px]">
            <Accordion type="single" collapsible className="w-full" onValueChange={handleAccordionChange}>
              {FAQS.map((faq, i) => (
                <AccordionItem
                  value={`item-${i}`}
                  key={faq.q}
                  className="border-0 rounded-md px-[14px] md:px-[18px] py-[6px]"
                >
                  <AccordionTrigger
                    aria-controls={`faq-content-${i}`}
                    className="text-left text-foreground hover:text-brand-primary hover:no-underline text-body-mobile md:text-body-desktop font-medium focus-ring rounded-md py-[14px]"
                  >
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent
                    id={`faq-content-${i}`}
                    className="text-body-mobile md:text-body-desktop text-text-secondary leading-body pb-[14px]"
                  >
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </LandingCard>
        </motion.div>
      </LandingContainer>
    </motion.section>
  );
}
