import React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonItem {
  before: string;
  after: string;
}

export function BeforeAfterToggle(props: { items: ComparisonItem[] }) {
  return (
    <div className="grid gap-[18px] lg:grid-cols-2">
      <ComparisonColumn
        title="Without a system"
        tone="muted"
        icon={Minus}
        items={props.items.map((i) => i.before)}
      />
      <ComparisonColumn
        title="With SMMAHUB"
        tone="primary"
        icon={Check}
        items={props.items.map((i) => i.after)}
      />
    </div>
  );
}

function ComparisonColumn(props: {
  title: string;
  tone: "muted" | "primary";
  icon: typeof Check;
  items: string[];
}) {
  const Icon = props.icon;
  const toneClasses =
    props.tone === "primary"
      ? "border-brand-primary/25 bg-brand-primary/[0.06]"
      : "border-white/10 bg-white/[0.03]";

  const iconWrapClasses =
    props.tone === "primary" ? "bg-brand-primary/20 text-brand-primary" : "bg-white/10 text-text-muted";

  return (
    <div className={cn("rounded-md border p-[18px] md:p-[22px]", toneClasses)}>
      <div className="flex items-center gap-[10px]">
        <span className={cn("h-8 w-8 rounded-lg grid place-items-center", iconWrapClasses)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-sm font-semibold text-foreground tracking-tight">{props.title}</div>
      </div>

      <ul className="mt-[14px] space-y-[10px]">
        {props.items.map((text) => (
          <li key={text} className="flex gap-[12px]">
            <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-white/25 shrink-0" />
            <p className="text-body-mobile md:text-body-desktop text-text-secondary leading-body">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

