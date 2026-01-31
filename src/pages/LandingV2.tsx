// deno-lint-ignore-file
import React, { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { Play, ArrowRight, Zap } from "lucide-react";


import Hero from "../components/landing/Hero.tsx";
import DualBrain from "../components/landing/DualBrain.tsx";
import FAQ from "../components/landing/FAQ.tsx";
import Features from "../components/landing/Features.tsx";
import FinalCTA from "../components/landing/FinalCTA.tsx";
import HowItWorks from "../components/landing/HowItWorks.tsx";
import ProblemSection from "../components/landing/ProblemSection.tsx";
import ROI from "../components/landing/ROI.tsx";
import SocialProof from "../components/landing/SocialProof.tsx";
import SolutionTable from "../components/landing/SolutionTable.tsx";
import Pricing from "./Pricing.tsx";
import { Button } from "../components/ui/button.tsx";

const CAL_LINK = "https://cal.com/SMMAHUB/fit";
const LOOM_LINK = "https://loom.com/share/LOOM_ID";

// Scroll Progress Indicator
function ScrollProgressIndicator() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-primary to-accent z-[100] origin-left"
      style={{ scaleX }}
    />
  );
}

// Sticky CTA Bar (appears after scrolling past hero)
function StickyCTABar() {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      // Show after scrolling past ~50vh (approximately hero section)
      const threshold = typeof window !== "undefined" ? globalThis.innerHeight * 0.5 : 500;
      setIsVisible(latest > threshold);
    });
    return () => unsubscribe();
  }, [scrollY]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-[99] bg-background/95 backdrop-blur-xl border-b border-white/10"
        >
          <div className="container mx-auto flex items-center justify-between gap-[4px] px-[4px] py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold tracking-tight hidden sm:inline">SMMAHUB</span>
              <span className="text-small-text text-text-muted hidden md:inline">
                Scale to 2X Your Clients Without Hiring
              </span>
            </div>

            <div className="flex items-center gap-[12px]">
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="hidden sm:inline-flex text-text-muted hover:text-foreground tracking-cta-text"
              >
                <a href={LOOM_LINK} target="_blank" rel="noreferrer">
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Demo
                </a>
              </Button>
              <Button
                asChild
                size="sm"
                className="btn-glow btn-shimmer btn-primary-enhanced tracking-cta-text"
              >
                <a href={CAL_LINK} target="_blank" rel="noreferrer">
                  <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                  Book Audit
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Navigation() {
  const { scrollY } = useScroll();
  const backgroundColor = useTransform(
    scrollY,
    [0, 100],
    ["rgba(5, 5, 5, 0.7)", "rgba(5, 5, 5, 0.95)"]
  );

  return (
    <motion.nav
      className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl"
      style={{ backgroundColor }}
    >
      <div className="container mx-auto flex items-center justify-between gap-[4px] px-[4px] py-[4px]">
        <a href="#top" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">SMMAHUB</span>
        </a>

        <div className="flex items-center gap-[12px]">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex text-text-muted hover:text-foreground tracking-cta-text"
          >
            <a href={LOOM_LINK} target="_blank" rel="noreferrer">
              <Play className="w-4 h-4 mr-1.5" />
              Watch Demo
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            className="btn-glow btn-shimmer btn-primary-enhanced tracking-cta-text"
          >
            <a href={CAL_LINK} target="_blank" rel="noreferrer">
              <ArrowRight className="w-4 h-4 mr-1.5" />
              Book Strategy Audit
            </a>
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50">
      <div className="container mx-auto px-[4px] py-[64px]">
        <div className="grid gap-[32px] md:grid-cols-3">
          {/* Brand */}
          <div className="flex flex-col gap-[16px]">
            <div className="flex items-center gap-[8px]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">SMMAHUB</span>
            </div>
            <p className="text-body-mobile md:text-body-desktop text-text-muted max-w-xs leading-body">
              Your agency's brain, in AI—consistent strategy at infinite scale.
            </p>
          </div>

          {/* Trust Signals */}
          <div className="flex flex-col gap-[16px]">
            <span className="text-body-desktop font-medium text-foreground">Trust & Security</span>
            <div className="flex flex-wrap gap-[12px] text-small-text text-text-muted">
              <span className="flex items-center gap-[8px] px-[12px] py-[8px] rounded-lg bg-white/5">
                SOC 2 Type II
              </span>
              <span className="flex items-center gap-[8px] px-[12px] py-[8px] rounded-lg bg-white/5">
                GDPR Ready
              </span>
              <span className="flex items-center gap-[8px] px-[12px] py-[8px] rounded-lg bg-white/5">
                256-bit Encryption
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-[16px]">
            <span className="text-body-desktop font-medium text-foreground">Links</span>
            <div className="flex flex-wrap gap-[24px] text-body-mobile text-text-muted">
              <a href="#" className="hover:text-foreground transition-colors focus-ring">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors focus-ring">Privacy</a>
              <a href="mailto:contact@smmahub.com" className="hover:text-foreground transition-colors focus-ring">Contact</a>
            </div>
          </div>
        </div>

        <div className="mt-[48px] pt-[24px] border-t border-border/50 flex flex-col md:flex-row md:items-center md:justify-between gap-[16px] text-small-text text-text-muted">
          <span>© 2026 SMMAHUB. All rights reserved.</span>
          <span>Built for social media marketing agencies.</span>
        </div>
      </div>
    </footer>
  );
}

export default function LandingV2() {
  useEffect(() => {
    console.log('Page View: Landing Page Loaded');
  }, []);

  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      {/* Ultra-premium scroll progress indicator */}
      <ScrollProgressIndicator />

      {/* Sticky CTA bar (appears after hero) */}
      <StickyCTABar />

      <Navigation />
      <main>
        <Hero />
        <SocialProof />
        <ProblemSection />
        <SolutionTable />
        <HowItWorks />
        <DualBrain />
        <Features />
        <ROI />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
