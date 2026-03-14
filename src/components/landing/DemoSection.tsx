import React from "react";
import { motion, useInView } from "framer-motion";
import { ExternalLink, Play, Sparkles, Check } from "lucide-react";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { marketing } from "@/lib/marketing";
import { getVideoEmbed } from "@/lib/videoEmbed";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const WHAT_YOU_SEE = [
  "How intake becomes a structured client profile",
  "A strategy brief generated from standards + context",
  "An approval-ready flow your team can run repeatedly",
];

export function DemoSection() {
  const sectionRef = useSectionTracking("Demo");
  const isInView = useInView(sectionRef, { once: true, amount: 0.25 });
  const demoUrl = marketing.demoUrl;
  const embed = getVideoEmbed(demoUrl);

  if (!demoUrl) return null;

  return (
    <motion.section
      id="demo"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.75 }}
      className="section-md lp-section"
    >
      <LandingContainer className="relative z-10">
        <SectionHeader
          eyebrow={<Pill icon={Sparkles}>Demo</Pill>}
          title={
            <>
              Watch the workflow
              <span className="block text-gradient-premium">end-to-end.</span>
            </>
          }
          lede="A tight walkthrough of how context becomes drafts, approvals, and repeatable delivery."
        />

        <div className="mt-[44px] mx-auto max-w-6xl grid gap-[12px] lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <LandingCard className="gradient-border-animated p-[14px] md:p-[18px] overflow-hidden">
            {embed.embedUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-black/20">
                <iframe
                  title="SMMAHUB demo video"
                  className="absolute inset-0 h-full w-full"
                  src={embed.embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-[56px] text-center">
                <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center mb-[14px]">
                  <Play className="w-6 h-6 text-foreground" />
                </div>
                <p className="text-body-mobile md:text-body-desktop text-text-secondary leading-body max-w-prose-landing">
                  This demo link cannot be embedded, but it is ready to watch in a new tab.
                </p>
              </div>
            )}

            <div className="mt-[14px] flex flex-col sm:flex-row items-center justify-between gap-[10px]">
              <div className="text-small-text text-text-muted">
                Prefer a new tab?{" "}
                <a
                  className="text-foreground hover:text-brand-primary transition-colors underline-offset-4 hover:underline"
                  href={demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("cta_watch_demo_click", { location: "demo_section" })}
                >
                  Open demo
                </a>
                .
              </div>
              <Button asChild variant="outline" className="btn-secondary-enhanced tracking-cta-text">
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("cta_watch_demo_click", { location: "demo_section_button" })}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Watch demo
                </a>
              </Button>
            </div>
          </LandingCard>

          <LandingCard className="p-[22px] md:p-[26px]">
            <div className="text-sm font-semibold tracking-tight text-foreground">What you'll see</div>
            <ul className="mt-[14px] space-y-[10px]">
              {WHAT_YOU_SEE.map((line) => (
                <li key={line} className="flex gap-[10px]">
                  <div className="mt-[2px] h-6 w-6 rounded-full bg-brand-primary/15 flex items-center justify-center shrink-0">
                    <Check className="h-3.5 w-3.5 text-brand-primary" />
                  </div>
                  <p className="text-body-mobile md:text-body-desktop text-text-secondary leading-body">{line}</p>
                </li>
              ))}
            </ul>

            <div className="mt-[18px] text-small-text text-text-muted leading-small-text">
              Want a tailored walkthrough? Book a strategy audit and we map this to your workflow.
            </div>
          </LandingCard>
        </div>
      </LandingContainer>
    </motion.section>
  );
}
