import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll } from "framer-motion";
import { ArrowRight, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { LandingContainer } from "./LandingPrimitives";

export function LandingStickyBar(props: {
  calUrl: string;
  demoUrl?: string;
  demoEmbedUrl?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      const threshold = typeof window !== "undefined" ? globalThis.innerHeight * 0.55 : 560;
      setIsVisible(latest > threshold);
    });
    return () => unsubscribe();
  }, [scrollY]);

  const hasDemo = Boolean(props.demoUrl);
  const demoIsEmbed = Boolean(props.demoEmbedUrl);
  const demoHref = demoIsEmbed ? "#workflow" : props.demoUrl!;

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-[90] border-b border-white/10 bg-background/85 backdrop-blur-xl"
          role="region"
          aria-label="Quick actions"
        >
          <LandingContainer className="flex items-center justify-between gap-[12px] py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="hidden min-w-0 sm:block">
                <div className="text-sm font-semibold tracking-tight">SMMAHUB</div>
                <div className="truncate text-xs text-text-muted">
                  One system for context, workflow, approvals, and AI execution.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-[10px]">
              {hasDemo ? (
                <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex text-text-muted hover:text-foreground tracking-cta-text">
                  <a
                    href={demoHref}
                    target={demoIsEmbed ? undefined : "_blank"}
                    rel={demoIsEmbed ? undefined : "noreferrer"}
                    onClick={() => track("cta_watch_demo_click", { location: "sticky_bar" })}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Walkthrough
                  </a>
                </Button>
              ) : null}

              <Button asChild size="sm" className="btn-primary-enhanced tracking-cta-text">
                <a
                  href={props.calUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("cta_book_strategy_audit_click", { location: "sticky_bar" })}
                >
                  <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                  Book strategy audit
                </a>
              </Button>
            </div>
          </LandingContainer>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
