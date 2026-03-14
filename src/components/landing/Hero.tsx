import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CalendarClock,
  Check,
  ClipboardCheck,
  Play,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Button } from "../ui/button.tsx";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";
import { LandingContainer, Pill } from "./LandingPrimitives";

const CAL_LINK = marketing.calUrl;
const DEMO_LINK = marketing.demoUrl;

const HERO_BULLETS = [
  "One operating system for setup, strategy, delivery, approvals, and client collaboration",
  "AI works from approved playbooks, real client context, and workflow state",
  "Less owner oversight, less chasing, and more consistent execution across every account",
];

const PROOF_STRIP = ["Client context", "Workflow state", "Approval rules", "AI specialists", "Audit trail"];

export default function Hero() {
  const smoothEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

  return (
    <header className="relative overflow-hidden landing-bg-clean">
      <LandingContainer className="relative z-10 py-[92px] md:py-[120px]">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-[56px] lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: smoothEase }}>
                <Pill icon={Sparkles}>Agency operating system</Pill>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: smoothEase }}
                className="mt-[18px] text-hero-headline-mobile md:text-hero-headline-desktop font-semibold leading-hero-headline tracking-hero-headline"
              >
                The Agency Operating System
                <span className="block text-gradient-premium">With an AI Employee Layer.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.62, delay: 0.2, ease: smoothEase }}
                className="mt-[16px] max-w-prose-landing text-subheadline-mobile md:text-subheadline-desktop text-text-secondary leading-subheadline tracking-subheadline"
              >
                Run client setup, strategy, delivery, approvals, and client collaboration from one system where AI
                works from your rules, your playbooks, and your real client context.
              </motion.p>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } } }}
                className="mt-[28px] space-y-[14px]"
              >
                {HERO_BULLETS.map((bullet) => (
                  <motion.div
                    key={bullet}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: smoothEase } },
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
                transition={{ duration: 0.65, delay: 0.38, ease: smoothEase }}
                className="mt-[40px] flex flex-col sm:flex-row gap-[14px]"
              >
                <Button asChild size="lg" className="btn-primary-enhanced tracking-cta-text">
                  <a
                    href={CAL_LINK}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("cta_book_strategy_audit_click", { location: "hero" })}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Book strategy audit
                  </a>
                </Button>

                {DEMO_LINK ? (
                  <Button asChild size="lg" variant="outline" className="btn-secondary-enhanced tracking-cta-text">
                    <a
                      href="#workflow"
                      className="inline-flex items-center gap-2"
                      onClick={() => track("cta_watch_demo_click", { location: "hero_operating_system" })}
                    >
                      <Play className="w-4 h-4" />
                      See how the operating system works
                    </a>
                  </Button>
                ) : null}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.55, delay: 0.52, ease: smoothEase }}
                className="mt-[20px] text-small-text text-text-muted leading-small-text tracking-small-text"
              >
                Built for agencies that need one system of record for context, workflow state, approvals, and execution.
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.55, delay: 0.6, ease: smoothEase }}
                className="mt-[24px] flex flex-wrap gap-[10px]"
              >
                {PROOF_STRIP.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/8 bg-white/[0.03] px-[12px] py-[8px] text-small-text text-text-secondary"
                  >
                    {item}
                  </span>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.85, delay: 0.32, ease: smoothEase }}
              className="relative"
            >
              <div className="relative">
                <div className="absolute -inset-10 rounded-[32px] bg-gradient-to-br from-primary/14 via-accent/10 to-transparent blur-3xl" />
                <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1324]/92 shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
                  <div className="border-b border-white/8 bg-white/[0.03] px-[18px] py-[16px]">
                    <div className="flex items-center justify-between gap-[12px]">
                      <div>
                        <div className="text-sm font-semibold text-foreground">SMMAHUB Operating Spine</div>
                        <div className="mt-[4px] text-xs text-text-muted">
                          Context layer, workflow layer, agent layer, and write-back in one system
                        </div>
                      </div>
                      <div className="rounded-full border border-success/20 bg-success/10 px-[10px] py-[6px] text-xs font-medium text-success">
                        Governed
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-[14px] p-[18px] lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-[14px]">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-[16px]">
                        <div className="flex items-center gap-[10px] text-sm font-semibold text-foreground">
                          <BrainCircuit className="h-4 w-4 text-primary" />
                          Context layer
                        </div>
                        <div className="mt-[12px] space-y-[10px]">
                          {[
                            "Agency playbooks",
                            "Client operating brief",
                            "Approval rules",
                            "Quality bar",
                          ].map((item) => (
                            <div key={item} className="rounded-xl border border-white/8 bg-background/60 px-[12px] py-[10px] text-xs text-text-secondary">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-[16px]">
                        <div className="flex items-center gap-[10px] text-sm font-semibold text-foreground">
                          <Workflow className="h-4 w-4 text-accent" />
                          Workflow state
                        </div>
                        <div className="mt-[12px] flex flex-wrap gap-[8px]">
                          {["Onboarding", "Strategy review", "Production active", "Approvals pending"].map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-white/8 bg-background/60 px-[10px] py-[7px] text-xs text-text-secondary"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-[14px]">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-[16px]">
                        <div className="flex items-center gap-[10px] text-sm font-semibold text-foreground">
                          <BadgeCheck className="h-4 w-4 text-success" />
                          AI specialists
                        </div>
                        <div className="mt-[12px] grid gap-[10px] md:grid-cols-2">
                          {[
                            "Strategist",
                            "Creator",
                            "Operator",
                            "Analyst",
                          ].map((item) => (
                            <div key={item} className="rounded-xl border border-white/8 bg-background/60 px-[12px] py-[12px] text-xs text-text-secondary">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-primary/8 to-accent/8 p-[16px]">
                        <div className="flex items-center gap-[10px] text-sm font-semibold text-foreground">
                          <ClipboardCheck className="h-4 w-4 text-primary" />
                          Write-back into the operating system
                        </div>
                        <div className="mt-[12px] grid gap-[10px] sm:grid-cols-3">
                          <div className="rounded-xl border border-white/8 bg-background/60 px-[12px] py-[12px] text-xs text-text-secondary">
                            Tasks & dependencies
                          </div>
                          <div className="rounded-xl border border-white/8 bg-background/60 px-[12px] py-[12px] text-xs text-text-secondary">
                            Approvals & blockers
                          </div>
                          <div className="rounded-xl border border-white/8 bg-background/60 px-[12px] py-[12px] text-xs text-text-secondary">
                            Calendar & next actions
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-[16px]">
                        <div className="flex items-center gap-[10px] text-sm font-semibold text-foreground">
                          <CalendarClock className="h-4 w-4 text-accent" />
                          Why it matters
                        </div>
                        <p className="mt-[10px] text-sm leading-6 text-text-secondary">
                          The system does not just generate. It coordinates context, lifecycle state, approvals, and execution
                          so agency work becomes more consistent and less dependent on founder memory.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </LandingContainer>
    </header>
  );
}

