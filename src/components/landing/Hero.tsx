import React from "react";
import { motion } from "framer-motion";
import { Check, Play, Sparkles } from "lucide-react";
import { Button } from "../ui/button.tsx";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";
import HeroMockup from "@/components/mockups/HeroMockup";
import MobileMockup from "@/components/mockups/MobileMockup";
import { LandingContainer, Pill } from "./LandingPrimitives";

const CAL_LINK = marketing.calUrl;
const DEMO_LINK = marketing.demoUrl;

const HERO_BULLETS = [
  "Centralize client context so nothing gets lost",
  "Generate strategy briefs and content angles in minutes",
  "Keep quality consistent with SOP-based workflows",
];

export default function Hero() {
  return (
    <header className="relative overflow-hidden landing-bg-clean">
      <LandingContainer className="py-[92px] md:py-[120px] relative z-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-[72px] lg:grid-cols-2 lg:items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <Pill icon={Sparkles}>For growth-stage agencies</Pill>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="mt-[18px] text-hero-headline-mobile md:text-hero-headline-desktop font-semibold leading-hero-headline tracking-hero-headline"
              >
                Scale clients without hiring.
                <span className="block text-gradient-premium">Turn SOPs into a system.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.16 }}
                className="mt-[16px] max-w-prose-landing text-subheadline-mobile md:text-subheadline-desktop text-text-secondary leading-subheadline tracking-subheadline"
              >
                SMMAHUB is an AI operating system for social media agencies: capture how you work once, then generate
                consistent strategies, briefs, and approvals across every client - with less back-and-forth.
              </motion.p>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.26 } } }}
                className="mt-[28px] space-y-[14px]"
              >
                {HERO_BULLETS.map((bullet) => (
                  <motion.div
                    key={bullet}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                    }}
                    className="flex items-start gap-[12px] text-body-mobile md:text-body-desktop text-text-secondary leading-body"
                  >
                    <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/20 flex-shrink-0">
                      <Check className="h-3 w-3 text-brand-primary" />
                    </div>
                    <span>{bullet}</span>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: 0.34 }}
                className="mt-[40px] flex flex-col sm:flex-row gap-[14px]"
              >
                <Button asChild size="lg" className="btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text">
                  <a
                    href={CAL_LINK}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("cta_book_strategy_audit_click", { location: "hero" })}
                  >
                    Book strategy audit
                  </a>
                </Button>

                {DEMO_LINK ? (
                  <Button asChild size="lg" variant="outline" className="btn-secondary-enhanced group tracking-cta-text">
                    <a
                      href={DEMO_LINK}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2"
                      onClick={() => track("cta_watch_demo_click", { location: "hero" })}
                    >
                      <Play className="w-4 h-4" />
                      Watch demo
                    </a>
                  </Button>
                ) : null}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.46 }}
                className="mt-[20px] text-small-text text-text-muted leading-small-text tracking-small-text"
              >
                Built for the workflow: intake - strategy - approvals - iteration.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.28 }}
              className="relative"
            >
              <div className="relative">
                <HeroMockup />
                <div className="hidden xl:block absolute -right-10 -bottom-16 scale-90 origin-bottom-right">
                  <MobileMockup />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </LandingContainer>
    </header>
  );
}

