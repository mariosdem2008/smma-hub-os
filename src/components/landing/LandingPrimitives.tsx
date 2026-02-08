import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function LandingContainer(props: { className?: string; children: React.ReactNode }) {
  return <div className={cn("container mx-auto px-[4px]", props.className)}>{props.children}</div>;
}

export function Pill(props: {
  className?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <span
      className={cn(
        "badge-gradient-border inline-flex items-center gap-2 text-small-text font-medium tracking-small-text text-brand-primary",
        props.className
      )}
    >
      {Icon ? <Icon className="h-4 w-4 text-brand-primary icon-glow" /> : null}
      <span>{props.children}</span>
    </span>
  );
}

export function SectionHeader(props: {
  align?: "left" | "center";
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  lede?: React.ReactNode;
  className?: string;
}) {
  const align = props.align ?? "center";
  return (
    <div className={cn(align === "center" ? "text-center" : "text-left", props.className)}>
      {props.eyebrow ? <div className="mb-[18px] flex justify-center">{props.eyebrow}</div> : null}
      <h2 className="text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
        {props.title}
      </h2>
      {props.subtitle ? (
        <p className="mt-[12px] text-subheadline-mobile md:text-subheadline-desktop text-text-secondary tracking-subheadline">
          {props.subtitle}
        </p>
      ) : null}
      {props.lede ? (
        <p className="mt-[16px] mx-auto max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
          {props.lede}
        </p>
      ) : null}
    </div>
  );
}

export function LandingCard(props: { className?: string; children: React.ReactNode }) {
  return <div className={cn("glass-card rounded-md", props.className)}>{props.children}</div>;
}

