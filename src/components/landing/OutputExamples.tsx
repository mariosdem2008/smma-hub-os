import React from "react";
import { motion } from "framer-motion";
import { Calendar, FileText, MessageSquare } from "lucide-react";
import { LandingCard } from "./LandingPrimitives";

export function OutputExamples() {
  return (
    <div className="grid gap-[12px] lg:grid-cols-3">
      <ExampleCard
        icon={FileText}
        title="Strategy brief"
        subtitle="Monthly direction + angles"
        tone="primary"
      >
        <div className="space-y-[12px]">
          <div className="rounded-md border border-white/10 bg-white/5 p-[14px]">
            <div className="text-xs font-semibold tracking-wider text-brand-primary uppercase">Theme</div>
            <div className="mt-[4px] text-sm text-foreground">Authority + trust</div>
            <div className="mt-[6px] text-sm text-text-secondary leading-body">
              Build credibility with proof, process transparency, and clear positioning against alternatives.
            </div>
          </div>

          <div className="rounded-md border border-white/10 bg-white/5 p-[14px]">
            <div className="text-xs font-semibold tracking-wider text-text-muted uppercase">Content angles</div>
            <ul className="mt-[10px] space-y-[8px]">
              {[
                "Behind-the-scenes: how results are produced",
                "Client story: what changed and why",
                "Myth-busting: common mistakes to avoid",
              ].map((line) => (
                <li key={line} className="flex gap-[10px]">
                  <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-white/30 shrink-0" />
                  <span className="text-sm text-text-secondary leading-body">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ExampleCard>

      <ExampleCard
        icon={Calendar}
        title="Weekly plan"
        subtitle="7-day posting map"
        tone="accent"
      >
        <div className="space-y-[8px]">
          {[
            { day: "Mon", type: "Educational carousel", time: "9:00 AM" },
            { day: "Tue", type: "Behind-the-scenes", time: "12:00 PM" },
            { day: "Wed", type: "Client proof", time: "3:00 PM" },
            { day: "Thu", type: "How-to tips", time: "9:00 AM" },
            { day: "Fri", type: "Team spotlight", time: "11:00 AM" },
            { day: "Sat", type: "Engagement post", time: "10:00 AM" },
            { day: "Sun", type: "Week recap", time: "6:00 PM" },
          ].map((item) => (
            <div
              key={`${item.day}-${item.type}`}
              className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-[12px] py-[10px]"
            >
              <div className="flex items-center gap-[10px] min-w-0">
                <span className="w-9 text-xs font-semibold text-foreground/90">{item.day}</span>
                <span className="text-sm text-text-secondary truncate">{item.type}</span>
              </div>
              <span className="text-xs text-text-muted">{item.time}</span>
            </div>
          ))}
        </div>
      </ExampleCard>

      <ExampleCard
        icon={MessageSquare}
        title="Post drafts"
        subtitle="Voice variations"
        tone="primary"
      >
        <div className="space-y-[10px]">
          {[
            {
              label: "Professional",
              text: "If your delivery relies on tribal knowledge, scaling will break. Here is the system we use to keep outputs consistent.",
            },
            {
              label: "Conversational",
              text: "Real talk: the problem is not tools - it is consistency. Here is how we turn a process into repeatable drafts.",
            },
            {
              label: "Story-driven",
              text: "Most agencies try to scale by working harder. The better move is to encode what already works, then reuse it.",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-md border border-white/10 bg-white/5 p-[12px]">
              <div className="text-xs font-semibold tracking-wider text-brand-primary uppercase">{item.label}</div>
              <div className="mt-[6px] text-sm text-text-secondary leading-body line-clamp-3">{item.text}</div>
            </div>
          ))}
        </div>

        <div className="mt-[12px] text-xs text-text-muted text-center">
          Generated from approved brand voice + client context.
        </div>
      </ExampleCard>
    </div>
  );
}

function ExampleCard(props: {
  icon: typeof FileText;
  title: string;
  subtitle: string;
  tone: "primary" | "accent";
  children: React.ReactNode;
}) {
  const Icon = props.icon;
  const tint = props.tone === "accent" ? "bg-accent/15 text-accent" : "bg-brand-primary/15 text-brand-primary";

  return (
    <div>
      <LandingCard className="glass-card-hover card-lift p-[18px] md:p-[20px] h-full">
        <div className="flex items-center gap-[12px] mb-[14px]">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tint}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-foreground">{props.title}</div>
            <div className="text-xs text-text-muted">{props.subtitle}</div>
          </div>
        </div>
        {props.children}
      </LandingCard>
    </div>
  );
}
