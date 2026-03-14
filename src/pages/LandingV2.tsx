// deno-lint-ignore-file
import React, { useEffect } from "react";
import { motion, useScroll, useSpring } from "framer-motion";

import Hero from "../components/landing/Hero.tsx";
import FAQ from "../components/landing/FAQ.tsx";
import FinalCTA from "../components/landing/FinalCTA.tsx";
import LandingPricing from "../components/landing/Pricing.tsx";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";
import { getVideoEmbed } from "@/lib/videoEmbed";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingStickyBar } from "@/components/landing/LandingStickyBar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  LandingAiLayerSection,
  LandingFitSection,
  LandingHonestPromiseSection,
  LandingOperatingModelSection,
  LandingProblemSection,
  LandingProofSection,
  LandingReframeSection,
  LandingSurfaceMapSection,
  LandingTrustStrip,
  LandingValueSection,
} from "@/components/landing/OperatingSystemSections";

const CAL_LINK = marketing.calUrl;
const DEMO_LINK = marketing.demoUrl;
const DEMO_EMBED = getVideoEmbed(DEMO_LINK).embedUrl;

function ScrollProgressIndicator() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 65,
    damping: 24,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-primary to-accent z-[100] origin-left"
      style={{ scaleX }}
    />
  );
}

export default function LandingV2() {
  useEffect(() => {
    track("landing_view", { path: globalThis.location?.pathname ?? "/" });

    const fired = new Set<number>();
    const milestones = [25, 50, 75, 100];

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const percent = scrollHeight <= 0 ? 100 : Math.round((doc.scrollTop / scrollHeight) * 100);

      for (const milestone of milestones) {
        if (percent >= milestone && !fired.has(milestone)) {
          fired.add(milestone);
          track("landing_scroll_depth", { percent: milestone });
        }
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div id="top" className="landing landing-theme-b min-h-screen bg-background text-foreground">
      <ScrollProgressIndicator />

      <LandingStickyBar calUrl={CAL_LINK} demoUrl={DEMO_LINK} demoEmbedUrl={DEMO_EMBED ?? undefined} />
      <LandingNav calUrl={CAL_LINK} demoUrl={DEMO_LINK} demoEmbedUrl={DEMO_EMBED ?? undefined} />

      <main>
        <Hero />
        <LandingTrustStrip />
        <LandingProblemSection />
        <LandingReframeSection />
        <LandingOperatingModelSection />
        <LandingAiLayerSection />
        <LandingValueSection />
        <LandingSurfaceMapSection />
        <LandingProofSection />
        <LandingHonestPromiseSection />
        <LandingFitSection />
        <LandingPricing />
        <FAQ />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
