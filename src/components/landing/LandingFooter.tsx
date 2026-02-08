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
            <p className="text-body-mobile md:text-body-desktop text-text-muted max-w-xs leading-body">
              Your agency's brain in AI. Consistent strategy and approvals at scale.
            </p>
          </div>

          <div className="flex flex-col gap-[12px]">
            <span className="text-body-desktop font-medium text-foreground">Trust & security</span>
            <div className="flex flex-wrap gap-[10px] text-small-text text-text-muted">
              <span className="px-[12px] py-[8px] rounded-lg bg-white/5">Encrypted at rest</span>
              <span className="px-[12px] py-[8px] rounded-lg bg-white/5">Encrypted in transit</span>
              <span className="px-[12px] py-[8px] rounded-lg bg-white/5">Tenant isolation</span>
            </div>
          </div>

          <div className="flex flex-col gap-[12px]">
            <span className="text-body-desktop font-medium text-foreground">Links</span>
            <div className="flex flex-wrap gap-[18px] text-body-mobile text-text-muted">
              <a href="/terms" className="hover:text-foreground transition-colors focus-ring rounded-md">
                Terms
              </a>
              <a href="/privacy" className="hover:text-foreground transition-colors focus-ring rounded-md">
                Privacy
              </a>
              <a
                href="mailto:contact@smmahub.com"
                className="hover:text-foreground transition-colors focus-ring rounded-md"
              >
                Contact
              </a>
            </div>
          </div>
        </div>

        <div className="mt-[48px] pt-[24px] border-t border-border/50 flex flex-col md:flex-row md:items-center md:justify-between gap-[16px] text-small-text text-text-muted">
          <span>© 2026 SMMAHUB. All rights reserved.</span>
          <span>Built for social media marketing agencies.</span>
        </div>
      </LandingContainer>
    </footer>
  );
}

