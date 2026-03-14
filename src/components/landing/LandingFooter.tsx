import React from "react";
import { Zap } from "lucide-react";
import { LandingContainer } from "./LandingPrimitives";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/50">
      <LandingContainer className="py-[64px]">
        <div className="grid gap-[32px] md:grid-cols-3">
          <div className="flex flex-col gap-[14px]">
            <div className="flex items-center gap-[8px]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">SMMAHUB</span>
            </div>
            <p className="max-w-xs text-body-mobile leading-body text-text-muted md:text-body-desktop">
              An agency operating system with a governed AI employee layer for context, workflow, approvals, and execution.
            </p>
          </div>

          <div className="flex flex-col gap-[12px]">
            <span className="text-body-desktop font-medium text-foreground">Trust & security</span>
            <div className="flex flex-wrap gap-[10px] text-small-text text-text-muted">
              <span className="rounded-lg bg-white/5 px-[12px] py-[8px]">Encrypted at rest</span>
              <span className="rounded-lg bg-white/5 px-[12px] py-[8px]">Encrypted in transit</span>
              <span className="rounded-lg bg-white/5 px-[12px] py-[8px]">Tenant isolation</span>
            </div>
          </div>

          <div className="flex flex-col gap-[12px]">
            <span className="text-body-desktop font-medium text-foreground">Links</span>
            <div className="flex flex-wrap gap-[18px] text-body-mobile text-text-muted">
              <a href="/terms" className="rounded-md transition-colors hover:text-foreground focus-ring">
                Terms
              </a>
              <a href="/privacy" className="rounded-md transition-colors hover:text-foreground focus-ring">
                Privacy
              </a>
              <a href="mailto:contact@smmahub.com" className="rounded-md transition-colors hover:text-foreground focus-ring">
                Contact
              </a>
            </div>
          </div>
        </div>

        <div className="mt-[48px] flex flex-col gap-[16px] border-t border-border/50 pt-[24px] text-small-text text-text-muted md:flex-row md:items-center md:justify-between">
          <span>© 2026 SMMAHUB. All rights reserved.</span>
          <span>Built for agencies that need less owner oversight and more operational consistency.</span>
        </div>
      </LandingContainer>
    </footer>
  );
}
