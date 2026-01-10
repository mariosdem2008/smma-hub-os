import { useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  FileText,
  Zap,
  Check,
  Play,
  UserCheck,
  Layers,
  Calendar,
  MessageSquare,
  Brain,
  FileCheck,
  Workflow,
} from "lucide-react";

import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { AnimatedSection, StaggerContainer, StaggerItem } from "@/components/landing/AnimatedSection";
import { BeforeAfterToggle } from "@/components/landing/BeforeAfterToggle";
import { WorkflowStepper } from "@/components/landing/WorkflowStepper";
import { ROICalculator } from "@/components/landing/ROICalculator";
import { OutputExamples } from "@/components/landing/OutputExamples";

// ============================================================================
// CONSTANTS
// ============================================================================

const CAL_LINK = "https://cal.com/SMMAHUB/fit";
const LOOM_LINK = "https://loom.com/share/LOOM_ID";

const NAV_LINKS = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Outputs", href: "#outputs" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const HERO_STATS = [
  { label: "Time saved", value: "15–20 hours/client" },
  { label: "Consistency", value: "Your proven SOPs" },
  { label: "Scalability", value: "No hiring needed" },
  { label: "Availability", value: "24/7 standby" },
];

const HERO_OUTCOMES = [
  "Save 15–20 hours per client monthly on repetitive work",
  "Manage 2× more clients without adding headcount",
  "Maintain SOP consistency across all deliverables",
  "Preserve client context and approvals permanently",
];

const BEFORE_AFTER_ITEMS = [
  {
    before: "Hire 1 person for every 3 new clients",
    after: "Add 10+ clients with your current team",
  },
  {
    before: "Quality varies by who does the work",
    after: "Consistent output quality, every time",
  },
  {
    before: "Client knowledge walks out the door",
    after: "All client context captured and reusable",
  },
  {
    before: "Reactive firefighting, not strategic work",
    after: "Proactive strategy, not manual tasks",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Capture Your Playbook",
    desc: "Upload your successful strategies, SOPs, and client approaches once. The AI learns how your agency works.",
    icon: Layers,
  },
  {
    step: "02",
    title: "Automate Client Work",
    desc: "AI applies your processes consistently across all clients—strategies, content, and responses that match your standards.",
    icon: Zap,
  },
  {
    step: "03",
    title: "Scale Without Hiring",
    desc: "Take on more clients while your team focuses on creative direction and client relationships.",
    icon: UserCheck,
  },
];

const OUTPUTS = [
  {
    title: "Client Onboarding Deck",
    desc: "Auto-generated intake summary your clients can review and approve.",
    icon: FileText,
  },
  {
    title: "Strategy Documents",
    desc: "Monthly themes, content angles, and campaign briefs—ready for team review.",
    icon: Brain,
  },
  {
    title: "Content Drafts",
    desc: "Captions, scripts, and post variations aligned with client brand voice.",
    icon: MessageSquare,
  },
  {
    title: "Weekly Schedules",
    desc: "Content calendars with optimal posting times based on client goals.",
    icon: Calendar,
  },
  {
    title: "Client Brain Summary",
    desc: "Living document of everything the AI knows—exportable, shareable.",
    icon: Layers,
  },
  {
    title: "Approval Workflows",
    desc: "Client portal for reviews, feedback collection, and sign-off tracking.",
    icon: FileCheck,
  },
];

const GUARDRAILS = [
  {
    title: "No-Guessing Policy",
    desc: "If information isn't approved, the AI says UNKNOWN instead of inventing answers. Your clients never see hallucinated content.",
    icon: ShieldCheck,
  },
  {
    title: "Approval-Based Learning",
    desc: "Only learns from explicitly approved content and strategies. Quality control stays in your hands.",
    icon: FileCheck,
  },
  {
    title: "Client Isolation",
    desc: "Each client's data is completely separate. Zero cross-contamination between accounts.",
    icon: Lock,
  },
  {
    title: "Human-in-the-Loop",
    desc: "AI drafts, humans approve. Nothing goes live without your sign-off.",
    icon: UserCheck,
  },
];

const PLANS = [
  {
    name: "Free/Trial",
    price: "$0",
    period: "",
    line: "3 clients · 1 user · 5 GB",
    desc: "Test drive with a few clients and prove the time savings.",
  },
  {
    name: "Starter",
    price: "$399",
    period: "/month",
    line: "10 clients · 3 users · 50 GB",
    desc: "For agencies ready to systemize and scale their operations.",
  },
  {
    name: "Growth",
    price: "$799",
    period: "/month",
    line: "25 clients · 5 users · 200 GB",
    desc: "For growing agencies managing multiple clients efficiently.",
    highlight: true,
  },
  {
    name: "Scale/Pro",
    price: "$1,299",
    period: "/month",
    line: "Unlimited clients · 10 users · 500 GB",
    desc: "For established agencies scaling to the next level.",
  },
];

const ADDONS = [
  "Extra storage",
  "Extra clients",
  "Extra users",
  "Additional platforms",
];

const FAQS = [
  {
    q: "How much time will this actually save?",
    a: "Pilot agencies report saving 15-20 hours per client monthly on repetitive tasks like onboarding, strategy building, and content drafting. This frees your team to focus on creative direction and client relationships.",
  },
  {
    q: "Does this replace my employees?",
    a: "No—it replaces repetitive tasks, not people. Your team moves from doing manual work to overseeing quality, building client relationships, and strategic thinking. Most agencies use the time savings to take on more clients without hiring.",
  },
  {
    q: "How long until we see results?",
    a: "Most agencies see time savings within the first month. Start with 1-2 clients, upload your successful strategies, and let the AI handle the repetitive work. Scale across your roster as you see the results.",
  },
  {
    q: "What if we have unique processes?",
    a: "SMMAHUB learns from your specific SOPs and successful strategies. It doesn't impose generic templates—it applies what already works for your agency, consistently.",
  },
  {
    q: "How is client data protected?",
    a: "Each agency and client workspace is completely isolated. Client data never mixes between accounts. We use industry-standard encryption and security practices.",
  },
  {
    q: "Will clients know we're using AI?",
    a: "They'll notice better consistency, faster turnaround, and more strategic focus. The AI works behind the scenes following your approved processes—your team maintains control and final approval over everything.",
  },
  {
    q: "What's the actual ROI?",
    a: "At minimum, you save one full-time employee's worth of repetitive work. This means you can either manage more clients without hiring, or reduce overhead while maintaining current client load. Most agencies achieve both.",
  },
  {
    q: "Which platforms are supported?",
    a: "Instagram, Facebook, and LinkedIn with more platforms coming soon. The system is designed to work with your existing workflow regardless of which platforms you manage for clients.",
  },
];

// ============================================================================
// NAVIGATION COMPONENT
// ============================================================================

function Navigation() {
  const { scrollY } = useScroll();
  const backgroundColor = useTransform(
    scrollY,
    [0, 100],
    ["rgba(5, 5, 5, 0.7)", "rgba(5, 5, 5, 0.95)"]
  );

  return (
    <motion.nav
      className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl"
      style={{ backgroundColor }}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
        <a href="#top" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">SMMAHUB</span>
        </a>

        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
          >
            <a href={LOOM_LINK} target="_blank" rel="noreferrer">
              <Play className="w-4 h-4 mr-1.5" />
              Watch Demo
            </a>
          </Button>
          <Button asChild size="sm" className="btn-glow">
            <a href={CAL_LINK} target="_blank" rel="noreferrer">
              Get an ROI Plan
            </a>
          </Button>
        </div>
      </div>
    </motion.nav>
  );
}

// ============================================================================
// HERO SECTION (2-column layout)
// ============================================================================

function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <header ref={ref} className="relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-56 right-[-200px] h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            {/* Left Column - Message */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
              >
                <Badge className="mb-5" variant="secondary">
                  For social media marketing agencies
                </Badge>
              </motion.div>

              <motion.h1
                className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl"
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                Replace 1 FTE with an SOP-Trained AI Employee
              </motion.h1>

              <motion.p
                className="mt-6 text-lg text-muted-foreground"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                Scale your agency without the overhead. Save 15–20 hours per client monthly on repetitive work and replace at least one FTE with an AI system that applies your proven processes consistently across all clients.
              </motion.p>

              <motion.div
                className="mt-6 grid gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.25 }}
              >
                {HERO_OUTCOMES.map((outcome) => (
                  <div key={outcome} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                    <span>{outcome}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div
                className="mt-8 flex flex-col gap-3 sm:flex-row"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <a href={CAL_LINK} target="_blank" rel="noreferrer">
                    Get an ROI Plan <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <a href={LOOM_LINK} target="_blank" rel="noreferrer">
                    <Play className="mr-2 h-4 w-4" />
                    Watch 6-min Demo
                  </a>
                </Button>
              </motion.div>

              <motion.p
                className="mt-4 text-xs text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                Pilot agencies save $4,000+/month in avoided hiring costs
              </motion.p>
            </div>

            {/* Right Column - FTE Proof Card */}
            <motion.div
              className="rounded-lg border bg-card/40 p-6"
              initial={{ opacity: 0, x: 30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <Workflow className="h-4 w-4" />
                  Your new competitive advantage
                </div>
                <h2 className="text-2xl font-semibold">The equivalent of a full-time employee</h2>
              </div>
              <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                <p>
                  While your competitors struggle with hiring and training, you'll scale efficiently with an AI Employee that works 24/7, never forgets a detail, and applies your best strategies consistently.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {HERO_STATS.map((item) => (
                    <div key={item.label} className="rounded-lg border bg-background/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-2 font-medium text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// BEFORE/AFTER SECTION
// ============================================================================

function BeforeAfterSection() {
  return (
    <section className="py-20 border-y border-border/50 bg-surface/30">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary mb-3">
              The Agency Scaling Problem
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your agency is stuck between growth and overhead
            </h2>
          </div>

          <BeforeAfterToggle items={BEFORE_AFTER_ITEMS} />
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// HOW IT WORKS SECTION
// ============================================================================

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              How It Works
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Systemize Once, Scale Forever
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Capture what makes your agency successful, then let the AI apply it consistently across all clients.
            </p>
          </div>

          <StaggerContainer className="grid gap-6 lg:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <StaggerItem key={step.step}>
                <motion.div
                  className="h-full p-6 rounded-lg bg-card border border-border"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <step.icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-xs font-bold tracking-[0.2em] text-muted-foreground">
                      STEP {step.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// WORKFLOW DEMO SECTION
// ============================================================================

function WorkflowDemoSection() {
  return (
    <section className="py-20 bg-surface/30">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              See It In Action
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              From Onboarding to Execution
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Watch how SMMAHUB transforms your client workflow from start to finish.
            </p>
          </div>

          <WorkflowStepper />
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// OUTPUTS SECTION
// ============================================================================

function OutputsSection() {
  return (
    <section id="outputs" className="py-20">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              What You Get
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Deliverables, Not Features
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Real outputs that save time and maintain quality across your client roster.
            </p>
          </div>

          <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {OUTPUTS.map((output) => (
              <StaggerItem key={output.title}>
                <motion.div
                  className="h-full p-6 rounded-lg bg-card border border-border"
                  whileHover={{ y: -4, borderColor: "hsl(var(--primary) / 0.3)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <output.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{output.title}</h3>
                  <p className="text-sm text-muted-foreground">{output.desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// GUARDRAILS SECTION
// ============================================================================

function GuardrailsSection() {
  return (
    <section className="py-20 bg-surface/30">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Built-In Reliability
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              An AI Employee You Can Actually Trust
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              The difference between "AI drafts" and an AI system your agency can depend on.
            </p>
          </div>

          <StaggerContainer className="grid gap-6 md:grid-cols-2">
            {GUARDRAILS.map((item) => (
              <StaggerItem key={item.title}>
                <motion.div
                  className="h-full p-6 rounded-lg bg-card border border-border"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// OUTPUT EXAMPLES SECTION
// ============================================================================

function OutputExamplesSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Real Output Examples
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              See What the AI Produces
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              These are illustrative examples. Actual outputs follow your agency's SOPs.
            </p>
          </div>

          <OutputExamples />
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// ROI CALCULATOR SECTION
// ============================================================================

function ROICalculatorSection() {
  return (
    <section className="py-20 bg-surface/30">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Calculate Your Savings
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              What's Your Agency Losing to Manual Work?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Adjust the sliders to see your potential time and cost savings.
            </p>
          </div>

          <div className="p-8 rounded-lg bg-card border border-border">
            <ROICalculator />
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// PRICING SECTION
// ============================================================================

function PricingSection() {
  return (
    <section id="pricing" className="py-20">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Pricing
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pay for Results, Not Software
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Every dollar spent should return as time saved and clients added. Most agencies save $4,000+/month in avoided hiring costs.
            </p>
          </div>

          <StaggerContainer className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <StaggerItem key={plan.name}>
                <motion.div
                  className={`h-full p-6 rounded-lg border ${
                    plan.highlight
                      ? "bg-card ring-1 ring-primary/30"
                      : "bg-card border-border"
                  }`}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {plan.highlight && (
                      <Badge variant="secondary" className="text-xs">
                        Most chosen
                      </Badge>
                    )}
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{plan.line}</p>
                  <p className="text-sm text-muted-foreground">{plan.desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* Add-ons section */}
          <div className="mt-10 rounded-lg border bg-card/40 p-8">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold">Add-ons available</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {ADDONS.map((addon) => (
                    <li key={addon} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{addon}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <Button asChild size="lg">
                  <a href={CAL_LINK} target="_blank" rel="noreferrer">
                    Get an ROI Plan
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href={LOOM_LINK} target="_blank" rel="noreferrer">
                    Watch 6-min Demo
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ SECTION
// ============================================================================

function FAQSection() {
  return (
    <section id="faq" className="py-20 bg-surface/30">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              FAQ
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Questions Before You Scale
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="rounded-xl border border-border bg-card/50 px-5 accordion-landing"
              >
                <AccordionTrigger className="text-left text-sm font-medium py-4 hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// FINAL CTA SECTION
// ============================================================================

function FinalCTASection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <AnimatedSection className="mx-auto max-w-4xl">
          <div className="p-10 md:p-14 rounded-lg border bg-card/45 text-center">
            <Badge variant="secondary" className="mb-4">
              Ready to scale efficiently?
            </Badge>

            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Stop trading time for revenue. Start scaling your agency.
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Book a 15-minute fit call. We'll calculate exactly how much time you'll save
              and how many more clients you can manage with your current team.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <a href={CAL_LINK} target="_blank" rel="noreferrer">
                  Get an ROI Plan <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
              >
                <a href={LOOM_LINK} target="_blank" rel="noreferrer">
                  <Play className="mr-2 h-4 w-4" />
                  Watch 6-min Demo
                </a>
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================

function Footer() {
  return (
    <footer className="border-t border-border/50">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold">SMMAHUB</div>
              <div className="text-xs text-muted-foreground">
                Scale your agency without the overhead
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <span>contact@smmahub.com</span>
          </div>

          <div className="text-xs text-muted-foreground">© 2025 SMMAHUB</div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN LANDING PAGE COMPONENT
// ============================================================================

export default function LandingV2() {
  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <ScrollProgress />
      <Navigation />
      <main>
        <HeroSection />
        <BeforeAfterSection />
        <HowItWorksSection />
        <WorkflowDemoSection />
        <OutputsSection />
        <GuardrailsSection />
        <OutputExamplesSection />
        <ROICalculatorSection />
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  );
}
