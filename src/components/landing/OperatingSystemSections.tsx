import React from "react";
import { motion, useInView } from "framer-motion";
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Blocks,
  BrainCircuit,
  BriefcaseBusiness,
  CircleOff,
  ClipboardCheck,
  FileStack,
  GitBranch,
  Lock,
  MessageSquareText,
  ShieldCheck,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import { useSectionTracking } from "@/hooks/useSectionTracking";
import { LandingCard, LandingContainer, Pill, SectionHeader } from "./LandingPrimitives";

const smoothEase = [0.22, 1, 0.36, 1] as const;

function SectionFrame(props: {
  id?: string;
  tracking: string;
  className?: string;
  children: React.ReactNode;
}) {
  const sectionRef = useSectionTracking(props.tracking);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <motion.section
      id={props.id}
      ref={sectionRef}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.7, ease: smoothEase }}
      className={props.className ?? "section-md lp-section"}
    >
      {props.children}
    </motion.section>
  );
}

const trustItems = [
  "Persistent agency and client context",
  "Lifecycle-based activation",
  "Approval-aware actions",
  "Traceable write-back",
  "Specialist AI roles",
];

export function LandingTrustStrip() {
  return (
    <section className="border-y border-white/6 bg-white/[0.02]">
      <LandingContainer className="py-[16px]">
        <div className="grid gap-[10px] md:grid-cols-5">
          {trustItems.map((item) => (
            <div
              key={item}
              className="rounded-full border border-white/8 bg-white/[0.03] px-[14px] py-[10px] text-center text-small-text text-text-secondary"
            >
              {item}
            </div>
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}

const pains = [
  {
    icon: FileStack,
    title: "Scattered client truth",
    body: "Client context lives across docs, Slack, calls, email, and memory instead of one durable system.",
  },
  {
    icon: Users,
    title: "Owner bottlenecks",
    body: "Founders become the quality bar, approval matrix, strategist, and operating fallback for every account.",
  },
  {
    icon: ClipboardCheck,
    title: "Approval delays",
    body: "Internal review and client signoff add drag because there is no clean approval-aware operating flow.",
  },
  {
    icon: Workflow,
    title: "Inconsistent quality",
    body: "Different team members interpret the same client differently, so delivery quality shifts across accounts.",
  },
  {
    icon: BrainCircuit,
    title: "Weak AI grounding",
    body: "Generic AI can draft. It cannot safely operate from your agency rules, playbooks, and account reality.",
  },
  {
    icon: AlertTriangle,
    title: "Workflow fragmentation",
    body: "Setup, strategy, production, portal, approvals, and reporting live in disconnected systems.",
  },
];

export function LandingProblemSection() {
  return (
    <SectionFrame id="problem" tracking="Landing Problem">
      <LandingContainer>
        <SectionHeader
          eyebrow={<Pill icon={AlertTriangle}>The real problem</Pill>}
          title={
            <>
              Agencies do not break because
              <span className="block text-gradient-premium">they lack tools.</span>
            </>
          }
          lede="They break because context, approvals, and delivery are scattered across too many places. That creates owner bottlenecks, quality drift, and AI output that looks polished but does not reflect how the agency actually works."
        />

        <div className="mt-[44px] grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {pains.map((pain, index) => (
            <motion.div
              key={pain.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.55, delay: index * 0.04, ease: smoothEase }}
            >
              <LandingCard className="h-full p-[22px] md:p-[26px]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <pain.icon className="h-5 w-5" />
                </div>
                <div className="mt-[16px] text-lg font-semibold text-foreground">{pain.title}</div>
                <p className="mt-[8px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                  {pain.body}
                </p>
              </LandingCard>
            </motion.div>
          ))}
        </div>
      </LandingContainer>
    </SectionFrame>
  );
}

const contrastCards = [
  {
    icon: MessageSquareText,
    title: "Not a chatbot",
    body: "SMMAHUB is not one generic assistant improvising from prompt text.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Not an onboarding questionnaire",
    body: "It does not stop at intake. It carries context into delivery, approvals, and execution.",
  },
  {
    icon: CircleOff,
    title: "Not a one-shot strategy generator",
    body: "It does not jump from partial input to a finished answer and call it done.",
  },
];

export function LandingReframeSection() {
  return (
    <SectionFrame tracking="Landing Reframe">
      <LandingContainer>
        <SectionHeader
          eyebrow={<Pill icon={Blocks}>Category reframe</Pill>}
          title={
            <>
              This is not another
              <span className="block text-gradient-premium">AI tool.</span>
            </>
          }
          lede="SMMAHUB combines persistent agency context, real client operating briefs, lifecycle-aware workflows, governed approvals, and specialist AI execution inside one connected system."
        />

        <div className="mt-[44px] grid gap-[14px] lg:grid-cols-3">
          {contrastCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.55, delay: index * 0.05, ease: smoothEase }}
            >
              <LandingCard className="h-full p-[24px] md:p-[28px]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/12 text-accent">
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="mt-[18px] text-xl font-semibold text-foreground">{card.title}</div>
                <p className="mt-[10px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                  {card.body}
                </p>
              </LandingCard>
            </motion.div>
          ))}
        </div>

        <LandingCard className="mt-[18px] p-[22px] md:p-[26px]">
          <div className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-4">
            {[
              "Persistent agency brain + client brief",
              "Specialist agents activated by workflow state",
              "Approval-aware execution and write-back",
              "One system of record across setup, delivery, and collaboration",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-[14px] py-[16px] text-sm text-text-secondary">
                {item}
              </div>
            ))}
          </div>
        </LandingCard>
      </LandingContainer>
    </SectionFrame>
  );
}

const operatingSteps = [
  {
    step: "01",
    title: "Teach the system how your agency works",
    body: "Capture playbooks, positioning, quality bar, approvals, and operating rules so AI works from real agency context.",
  },
  {
    step: "02",
    title: "Build a real operating brief for each client",
    body: "Go beyond shallow intake and store goals, constraints, stakeholders, deadlines, and operating reality.",
  },
  {
    step: "03",
    title: "Let specialist agents work only when lifecycle state allows it",
    body: "Agents activate by readiness, stage, permissions, and policy instead of because someone typed a prompt.",
  },
  {
    step: "04",
    title: "Turn outputs into tasks, approvals, plans, and next actions",
    body: "Recommendations and follow-ups write back into the workflow so the system supports execution, not just drafting.",
  },
];

export function LandingOperatingModelSection() {
  return (
    <SectionFrame id="workflow" tracking="Landing Operating Model">
      <LandingContainer>
        <SectionHeader
          eyebrow={<Pill icon={GitBranch}>How it works</Pill>}
          title={
            <>
              How the operating
              <span className="block text-gradient-premium">system works.</span>
            </>
          }
          lede="SMMAHUB follows the same logic your best operators already use, but makes it repeatable, visible, and governed."
        />

        <div className="mt-[48px] relative">
          <div className="hidden lg:block absolute left-[calc(25%-1px)] right-[calc(25%-1px)] top-6 h-px bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30" />
          <div className="grid gap-[16px] lg:grid-cols-4">
            {operatingSteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.55, delay: index * 0.05, ease: smoothEase }}
              >
                <LandingCard className="relative h-full p-[22px] md:p-[26px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/12 text-lg font-semibold text-primary">
                    {step.step}
                  </div>
                  <div className="mt-[18px] text-lg font-semibold text-foreground">{step.title}</div>
                  <p className="mt-[8px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                    {step.body}
                  </p>
                </LandingCard>
              </motion.div>
            ))}
          </div>
        </div>
      </LandingContainer>
    </SectionFrame>
  );
}

const agents = [
  {
    icon: Target,
    title: "Strategist",
    body: "Diagnoses readiness, evaluates tradeoffs, and shapes direction from real business context.",
    tag: "Readiness-gated",
  },
  {
    icon: BrainCircuit,
    title: "Creator",
    body: "Builds briefs, messaging, and content outputs from approved strategy and brand rules.",
    tag: "Brief-bound",
  },
  {
    icon: Workflow,
    title: "Operator",
    body: "Turns plans into tasks, deadlines, requests, approvals, and workflow actions.",
    tag: "Policy-aware",
  },
  {
    icon: BadgeCheck,
    title: "Analyst",
    body: "Interprets performance through your KPI lens and surfaces what matters now.",
    tag: "Signal-focused",
  },
  {
    icon: MessageSquareText,
    title: "Client-facing assistant",
    body: "Supports safe communication, information requests, and status visibility within policy.",
    tag: "Approval-aware",
  },
];

export function LandingAiLayerSection() {
  return (
    <SectionFrame tracking="Landing AI Layer">
      <LandingContainer>
        <SectionHeader
          eyebrow={<Pill icon={BrainCircuit}>AI employee layer</Pill>}
          title={
            <>
              Specialist AI,
              <span className="block text-gradient-premium">not one generic assistant.</span>
            </>
          }
          lede="SMMAHUB uses specialist agents that operate from approved context packs, workflow state, and clear boundaries."
        />

        <div className="mt-[44px] grid gap-[14px] md:grid-cols-2 xl:grid-cols-5">
          {agents.map((agent, index) => (
            <motion.div
              key={agent.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.55, delay: index * 0.04, ease: smoothEase }}
            >
              <LandingCard className="h-full p-[20px] md:p-[22px]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <agent.icon className="h-5 w-5" />
                </div>
                <div className="mt-[14px] text-base font-semibold text-foreground">{agent.title}</div>
                <p className="mt-[8px] text-sm leading-6 text-text-secondary">{agent.body}</p>
                <div className="mt-[14px] inline-flex rounded-full border border-white/8 bg-white/[0.03] px-[10px] py-[6px] text-xs text-text-muted">
                  {agent.tag}
                </div>
              </LandingCard>
            </motion.div>
          ))}
        </div>

        <LandingCard className="mt-[18px] p-[22px] md:p-[26px]">
          <div className="flex items-start gap-[12px]">
            <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">
                AI should not invent context.
              </div>
              <p className="mt-[6px] max-w-3xl text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                It should operate from approved context packs, workflow state, and clear boundaries. That is how the system becomes useful without pretending to be magic.
              </p>
            </div>
          </div>
        </LandingCard>
      </LandingContainer>
    </SectionFrame>
  );
}

const valuePoints = [
  "Fewer approval bottlenecks",
  "Less context hunting across tools",
  "Less owner review load",
  "Faster setup-to-production",
  "Cleaner client communication",
  "More consistency across team members",
];

export function LandingValueSection() {
  return (
    <SectionFrame tracking="Landing Value">
      <LandingContainer>
        <div className="grid gap-[28px] lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <Pill icon={BriefcaseBusiness}>Why agencies pay</Pill>
            <h2 className="mt-[18px] text-section-headline-mobile md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline">
              Weekly operating friction
              <span className="block text-gradient-premium">is expensive.</span>
            </h2>
            <p className="mt-[16px] max-w-prose-landing text-body-mobile md:text-body-desktop text-text-secondary leading-body">
              Agencies do not pay premium pricing for AI novelty. They pay when the system reduces real drag every week across strategy, delivery, approvals, and client communication.
            </p>
            <p className="mt-[16px] text-body-mobile md:text-body-desktop font-medium text-foreground">
              You are not buying more AI output. You are buying cleaner agency operations with less oversight overhead.
            </p>
          </div>

          <LandingCard className="p-[20px] md:p-[24px]">
            <div className="grid gap-[10px] sm:grid-cols-2">
              {valuePoints.map((point) => (
                <div
                  key={point}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-[14px] py-[16px] text-sm font-medium text-foreground"
                >
                  {point}
                </div>
              ))}
            </div>
          </LandingCard>
        </div>
      </LandingContainer>
    </SectionFrame>
  );
}

const surfaces = [
  "Agency setup",
  "Client onboarding",
  "Client workspace",
  "Approvals",
  "Content & calendar",
  "Client portal",
  "Reporting",
  "Billing & admin",
];

export function LandingSurfaceMapSection() {
  return (
    <SectionFrame id="surfaces" tracking="Landing Surfaces">
      <LandingContainer>
        <SectionHeader
          eyebrow={<Pill icon={Blocks}>Operating layer</Pill>}
          title={
            <>
              One operating layer,
              <span className="block text-gradient-premium">not five disconnected tools.</span>
            </>
          }
          lede="The value is not the number of surfaces. It is that they share one system of record for client context, workflow state, approvals, and execution."
        />

        <LandingCard className="mt-[44px] p-[22px] md:p-[30px]">
          <div className="grid gap-[12px] md:grid-cols-4">
            {surfaces.map((surface, index) => (
              <motion.div
                key={surface}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.45, delay: index * 0.03, ease: smoothEase }}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-[14px] py-[18px]"
              >
                <div className="text-sm font-semibold text-foreground">{surface}</div>
                <div className="mt-[6px] text-xs text-text-muted">Connected to the same operating record</div>
              </motion.div>
            ))}
          </div>
        </LandingCard>
      </LandingContainer>
    </SectionFrame>
  );
}

const trustBlocks = [
  {
    icon: ShieldCheck,
    title: "Governed approvals",
    body: "Sensitive actions stay behind explicit rules and approval paths.",
  },
  {
    icon: ArrowRightLeft,
    title: "Audit trail / traceability",
    body: "Outputs and actions stay tied to workflow and context history.",
  },
  {
    icon: BrainCircuit,
    title: "Persistent memory with source awareness",
    body: "The system works from stored agency and client context, not only from prompt text.",
  },
  {
    icon: Lock,
    title: "Internal-first activation",
    body: "Capabilities can unlock in preview, assist-only, or operational modes.",
  },
  {
    icon: AlertTriangle,
    title: "Blocked actions when readiness is weak",
    body: "If context or approvals are incomplete, the system should not pretend otherwise.",
  },
];

export function LandingProofSection() {
  return (
    <SectionFrame tracking="Landing Trust">
      <LandingContainer>
        <SectionHeader
          eyebrow={<Pill icon={ShieldCheck}>Proof & trust</Pill>}
          title={
            <>
              Activation is earned,
              <span className="block text-gradient-premium">not faked.</span>
            </>
          }
          lede="Premium positioning only works if the system is governed, visible, and constrained by readiness."
        />

        <div className="mt-[44px] grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {trustBlocks.map((block, index) => (
            <motion.div
              key={block.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.55, delay: index * 0.04, ease: smoothEase }}
            >
              <LandingCard className="h-full p-[22px] md:p-[24px]">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/12 text-success">
                  <block.icon className="h-5 w-5" />
                </div>
                <div className="mt-[16px] text-lg font-semibold text-foreground">{block.title}</div>
                <p className="mt-[8px] text-body-mobile md:text-body-desktop text-text-secondary leading-body">
                  {block.body}
                </p>
              </LandingCard>
            </motion.div>
          ))}
        </div>
      </LandingContainer>
    </SectionFrame>
  );
}

export function LandingHonestPromiseSection() {
  const does = ["Drafts", "Recommends", "Prioritizes", "Summarizes", "Coordinates", "Writes back into workflow"];
  const doesNot = ["Act without policy", "Invent missing context", "Bypass approvals", "Replace human judgment in edge cases"];

  return (
    <SectionFrame tracking="Landing Honest Promise">
      <LandingContainer>
        <SectionHeader
          eyebrow={<Pill icon={ShieldCheck}>Honest AI promise</Pill>}
          title={
            <>
              What the AI does and
              <span className="block text-gradient-premium">what it does not do.</span>
            </>
          }
          lede="This makes the product more trustworthy, not less valuable."
        />

        <div className="mt-[44px] grid gap-[16px] lg:grid-cols-2">
          <LandingCard className="p-[22px] md:p-[26px]">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-success">Does</div>
            <div className="mt-[14px] space-y-[10px]">
              {does.map((item) => (
                <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-[14px] py-[14px] text-sm text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </LandingCard>

          <LandingCard className="p-[22px] md:p-[26px]">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-warning">Does not</div>
            <div className="mt-[14px] space-y-[10px]">
              {doesNot.map((item) => (
                <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-[14px] py-[14px] text-sm text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </LandingCard>
        </div>
      </LandingContainer>
    </SectionFrame>
  );
}

export function LandingFitSection() {
  const fit = [
    "5-25 person agencies",
    "Recurring-retainer teams",
    "Approval, handoff, and context chaos",
    "Agencies that need one operating layer, not more point tools",
  ];
  const notFit = [
    "Solo low-complexity operators",
    "Highly custom no-process shops",
    "Teams looking for a generic AI content tool",
  ];

  return (
    <SectionFrame id="fit" tracking="Landing Fit">
      <LandingContainer>
        <SectionHeader
          eyebrow={<Pill icon={Users}>Ideal customer fit</Pill>}
          title={
            <>
              Built for agencies with
              <span className="block text-gradient-premium">real operating complexity.</span>
            </>
          }
          lede="The right buyers are agencies with enough workflow complexity to benefit from governed systems and structured execution."
        />

        <div className="mt-[44px] grid gap-[16px] lg:grid-cols-2">
          <LandingCard className="p-[22px] md:p-[26px]">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-success">Best fit</div>
            <div className="mt-[14px] space-y-[10px]">
              {fit.map((item) => (
                <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-[14px] py-[14px] text-sm text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </LandingCard>

          <LandingCard className="p-[22px] md:p-[26px]">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-text-muted">Not ideal</div>
            <div className="mt-[14px] space-y-[10px]">
              {notFit.map((item) => (
                <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-[14px] py-[14px] text-sm text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </LandingCard>
        </div>
      </LandingContainer>
    </SectionFrame>
  );
}
