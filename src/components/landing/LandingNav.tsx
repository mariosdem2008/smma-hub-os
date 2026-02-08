import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { LandingContainer } from "./LandingPrimitives";

export function LandingNav(props: {
  calUrl: string;
  demoUrl?: string;
  demoEmbedUrl?: string;
}) {
  const { scrollY } = useScroll();
  const backgroundColor = useTransform(
    scrollY,
    [0, 120],
    ["rgba(7, 10, 16, 0.55)", "rgba(7, 10, 16, 0.92)"]
  );

  const hasDemo = Boolean(props.demoUrl);
  const demoIsEmbed = Boolean(props.demoEmbedUrl);
  const demoHref = demoIsEmbed ? "#demo" : props.demoUrl!;

  return (
    <motion.nav
      className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl"
      style={{ backgroundColor }}
      aria-label="Primary"
    >
      <LandingContainer className="flex items-center justify-between gap-[12px] py-[10px]">
        <a href="#top" className="flex items-center gap-2 focus-ring rounded-md">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">SMMAHUB</span>
        </a>

        <div className="hidden md:flex items-center gap-[22px] text-sm text-text-muted">
          <a href="#workflow" className="hover:text-foreground transition-colors focus-ring rounded-md">
            How it works
          </a>
          <a href="#outputs" className="hover:text-foreground transition-colors focus-ring rounded-md">
            Outputs
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors focus-ring rounded-md">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors focus-ring rounded-md">
            FAQ
          </a>
          {hasDemo && demoIsEmbed ? (
            <a href="#demo" className="hover:text-foreground transition-colors focus-ring rounded-md">
              Demo
            </a>
          ) : null}
        </div>

        <div className="flex items-center gap-[12px]">
          {hasDemo ? (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="hidden sm:inline-flex text-text-muted hover:text-foreground tracking-cta-text"
            >
              <a
                href={demoHref}
                target={demoIsEmbed ? undefined : "_blank"}
                rel={demoIsEmbed ? undefined : "noreferrer"}
                onClick={() => track("cta_watch_demo_click", { location: "nav" })}
              >
                <Play className="w-4 h-4 mr-1.5" />
                Watch demo
              </a>
            </Button>
          ) : null}

          <Button asChild size="sm" className="btn-glow btn-shimmer btn-primary-enhanced tracking-cta-text">
            <a
              href={props.calUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("cta_book_strategy_audit_click", { location: "nav" })}
            >
              <ArrowRight className="w-4 h-4 mr-1.5" />
              Book strategy audit
            </a>
          </Button>
        </div>
      </LandingContainer>
    </motion.nav>
  );
}

