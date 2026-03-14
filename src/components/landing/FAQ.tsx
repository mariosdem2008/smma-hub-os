import React from "react";
import { motion, useInView } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { track } from "@/lib/analytics";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const FAQS = [
  {
    q: "Is this just another AI assistant for agencies?",
    a: "No. SMMAHUB is designed as an operating system where AI works from persistent agency rules, client context, workflow state, and approvals.",
  },
  {
    q: "What makes this different from ChatGPT?",
    a: "ChatGPT is not your system of record. SMMAHUB stores client truth, workflow state, approvals, and operating context so AI can work inside the agency's real process instead of starting from scratch every time.",
  },
  {
    q: "Is this mainly an onboarding product?",
    a: "No. Onboarding is one part of the system. The value comes from carrying context into strategy, delivery, approvals, reporting, and client collaboration.",
  },
  {
    q: "Does the AI act autonomously?",
    a: "Not in the autopilot sense. Capabilities are governed, approval-aware, role-specific, and constrained by readiness and policy.",
  },
  {
    q: "Who is this best for?",
    a: "Agencies with multiple active clients, recurring delivery work, and enough workflow complexity that scattered context and approvals create weekly drag.",
  },
  {
    q: "Why book a strategy audit instead of starting a free trial immediately?",
    a: "Because this product is operationally serious. The audit helps determine fit, map the workflow, and define where the AI employee layer should safely support the agency first.",
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
      transition={{ duration: 0.75 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={HelpCircle}>FAQ</Pill>}
          title={
            <>
              Common questions,
              <span className="block text-gradient-premium">clear operating answers.</span>
            </>
          }
          lede="This product is built to be ambitious but controlled. The right questions are about trust, fit, and operating value."
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-[44px] max-w-3xl"
        >
          <LandingCard className="p-[10px] md:p-[12px]">
            <Accordion type="single" collapsible className="w-full" onValueChange={handleAccordionChange}>
              {FAQS.map((faq, i) => (
                <AccordionItem value={`item-${i}`} key={faq.q} className="rounded-md border-0 px-[14px] py-[6px] md:px-[18px]">
                  <AccordionTrigger
                    aria-controls={`faq-content-${i}`}
                    className="rounded-md py-[14px] text-left text-body-mobile font-medium text-foreground hover:text-brand-primary hover:no-underline focus-ring md:text-body-desktop"
                  >
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent id={`faq-content-${i}`} className="pb-[14px] text-body-mobile leading-body text-text-secondary md:text-body-desktop">
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
