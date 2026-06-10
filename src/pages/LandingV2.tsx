import { useEffect, type ReactNode } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardCheck,
  Layers3,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";

const CAL_LINK = marketing.calUrl;
const DEMO_LINK = marketing.demoUrl;

const navItems = [
  { href: "#system", label: "System" },
  { href: "#workflow", label: "Workflow" },
  { href: "#proof", label: "Proof" },
  { href: "#pricing", label: "Pricing" },
];

const valueProps = [
  {
    icon: ShieldCheck,
    title: "AI stays inside your rules",
    description: "Strategy, content, and client replies inherit your approved playbooks, tone, quality bar, and escalation rules.",
  },
  {
    icon: Workflow,
    title: "Every client runs from one operating model",
    description: "Onboarding, approvals, content status, and next actions sit in one calm command layer.",
  },
  {
    icon: ClipboardCheck,
    title: "Nothing ships without approval",
    description: "Agency owners keep final control while the system prepares the work and flags what needs attention.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Configure expertise",
    description: "Capture offers, ICPs, guardrails, quality standards, and delivery preferences once.",
  },
  {
    step: "02",
    title: "Attach client context",
    description: "Each client gets goals, assets, constraints, approvals, and a live operating history.",
  },
  {
    step: "03",
    title: "Run governed execution",
    description: "AI drafts strategy and production inputs, then routes them through your review workflow.",
  },
];

const proofStats = [
  { value: "14", label: "days to structured rollout" },
  { value: "3.6x", label: "faster client context lookup" },
  { value: "0", label: "unguarded publishing paths" },
];

function ScrollProgressIndicator() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 28,
    restDelta: 0.001,
  });

  return <motion.div className="fixed left-0 right-0 top-0 z-[100] h-0.5 origin-left bg-primary" style={{ scaleX }} />;
}

function LandingShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">{children}</div>;
}

function ProductMockup() {
  const queue = [
    { label: "Apex Dental", status: "Approval", tone: "High priority" },
    { label: "Northline Fitness", status: "Strategy", tone: "Founder review" },
    { label: "Cedar Legal", status: "Scheduled", tone: "Ready" },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-2xl border border-primary/10" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-panel">
        <div className="flex items-center justify-between border-b border-border/80 bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-warning/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-success/80" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operator home</div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="hidden border-r border-border/80 bg-background/40 p-4 lg:block">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers3 className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-sm font-semibold">SMMAHUB</div>
                <div className="text-xs text-muted-foreground">Governed AI OS</div>
              </div>
            </div>
            {["Dashboard", "Clients", "AI Setup", "Approvals"].map((item, index) => (
              <div
                key={item}
                className={`mb-2 rounded-md px-3 py-2 text-sm ${
                  index === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                {item}
              </div>
            ))}
          </aside>

          <div className="p-4 sm:p-5">
            <div className="mb-5 flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge variant="secondary">Today needs attention</Badge>
                <h2 className="mt-3 font-display text-2xl font-bold">12 approvals under control</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  The system has prepared work, flagged risks, and kept client-facing outputs behind review.
                </p>
              </div>
              <Button size="sm">
                Review queue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Clients live", "18"],
                ["Pending approval", "12"],
                ["AI confidence", "91%"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/70 bg-surface/50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="mt-2 font-display text-2xl font-bold text-foreground">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {queue.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 p-3">
                  <div>
                    <div className="font-medium text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.tone}</div>
                  </div>
                  <Badge variant={item.status === "Scheduled" ? "green" : "default"}>{item.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingV2() {
  useEffect(() => {
    track("landing_view", { path: globalThis.location?.pathname ?? "/" });

    const fired = new Set<number>();
    const milestones = [25, 50, 75, 100];

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      const percent = scrollHeight <= 0 ? 100 : Math.round((doc.scrollTop / scrollHeight) * 100);

      for (const milestone of milestones) {
        if (percent >= milestone && !fired.has(milestone)) {
          fired.add(milestone);
          track("landing_scroll_depth", { percent: milestone });
        }
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <ScrollProgressIndicator />

      <a href="#main" className="skip-to-content">
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <LandingShell>
          <nav className="flex h-16 items-center justify-between gap-4" aria-label="Primary">
            <a href="#top" className="flex items-center gap-3 rounded-md focus-ring">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers3 className="h-4 w-4" />
              </div>
              <span className="font-display text-lg font-bold">SMMAHUB</span>
            </a>

            <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="rounded-md transition-colors hover:text-foreground focus-ring">
                  {item.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <a href="/auth">Sign in</a>
              </Button>
              <Button asChild size="sm">
                <a
                  href={CAL_LINK}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("cta_book_strategy_audit_click", { location: "nav" })}
                >
                  Book audit
                </a>
              </Button>
            </div>
          </nav>
        </LandingShell>
      </header>

      <main id="main">
        <section className="relative overflow-hidden border-b border-border/70">
          <LandingShell>
            <div className="grid gap-12 py-16 md:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                <Badge variant="secondary" className="mb-5">
                  Governed AI for agency operators
                </Badge>
                <h1 className="font-display text-h1-mobile text-foreground md:text-h1">
                  Configure your agency's expertise once. Run it across every client with governed AI.
                </h1>
                <p className="mt-6 max-w-[64ch] text-lg leading-8 text-muted-foreground">
                  SMMAHUB gives agency owners a premium operating system for client context, approvals, delivery state,
                  and AI-assisted execution that never bypasses human control.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <a
                      href={CAL_LINK}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => track("cta_book_strategy_audit_click", { location: "hero" })}
                    >
                      Book strategy audit
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  {DEMO_LINK ? (
                    <Button asChild size="lg" variant="outline">
                      <a
                        href={DEMO_LINK}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => track("cta_watch_demo_click", { location: "hero" })}
                      >
                        <Play className="h-4 w-4" />
                        Watch walkthrough
                      </a>
                    </Button>
                  ) : (
                    <Button asChild size="lg" variant="outline">
                      <a href="#workflow">
                        See workflow
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
                <div className="mt-7 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {["Human approval", "Client context", "Audit trail", "Premium portal"].map((item) => (
                    <span key={item} className="rounded-md border border-border/80 bg-muted/40 px-3 py-2">
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.12 }}
              >
                <ProductMockup />
              </motion.div>
            </div>
          </LandingShell>
        </section>

        <section id="system" className="border-b border-border/70 py-16 md:py-24">
          <LandingShell>
            <div className="max-w-3xl">
              <div className="page-eyebrow">The control layer</div>
              <h2 className="mt-3 section-title">AI output is only valuable when the system knows what good means.</h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                SMMAHUB turns founder taste, SOPs, client constraints, and approval rules into reusable operating
                context for every account.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {valueProps.map((item) => (
                <article key={item.title} className="rounded-xl border border-border/80 bg-card p-5 shadow-card">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </LandingShell>
        </section>

        <section id="workflow" className="border-b border-border/70 py-16 md:py-24">
          <LandingShell>
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <div className="page-eyebrow">How it works</div>
                <h2 className="mt-3 section-title">From founder memory to repeatable client execution.</h2>
                <p className="mt-5 text-lg leading-8 text-muted-foreground">
                  The product is designed for busy agency owners who need less chasing, fewer loose decisions, and a
                  cleaner way to supervise AI work.
                </p>
              </div>
              <div className="space-y-3">
                {workflow.map((item) => (
                  <article key={item.step} className="grid gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-card sm:grid-cols-[5rem_1fr]">
                    <div className="font-display text-3xl font-bold text-primary">{item.step}</div>
                    <div>
                      <h3 className="font-display text-xl font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </LandingShell>
        </section>

        <section id="proof" className="border-b border-border/70 py-16 md:py-24">
          <LandingShell>
            <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <div className="page-eyebrow">Early proof</div>
                <h2 className="mt-3 section-title">Built for agencies that sell trust, not prompt volume.</h2>
                <p className="mt-5 text-lg leading-8 text-muted-foreground">
                  Phase 1 uses conservative social proof placeholders until founder-approved case studies are published.
                  The promise is operational clarity: fewer hidden risks and more controlled output.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {proofStats.map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border/80 bg-card p-5 shadow-card">
                      <div className="metric-number text-3xl font-bold text-primary">{stat.value}</div>
                      <div className="mt-2 text-sm leading-5 text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <figure className="rounded-2xl border border-border/80 bg-card p-6 shadow-panel">
                <BadgeCheck className="h-8 w-8 text-primary" />
                <blockquote className="mt-6 font-display text-2xl font-semibold leading-snug">
                  "This is the first AI workflow that feels like an agency control room instead of another blank chat box."
                </blockquote>
                <figcaption className="mt-5 text-sm text-muted-foreground">Founder review placeholder, case study pending</figcaption>
              </figure>
            </div>
          </LandingShell>
        </section>

        <section id="pricing" className="border-b border-border/70 py-16 md:py-24">
          <LandingShell>
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <div className="page-eyebrow">Pricing</div>
                <h2 className="mt-3 section-title">Start with fit. Scope the rollout after the audit.</h2>
                <p className="mt-5 text-lg leading-8 text-muted-foreground">
                  Most agencies begin with a strategy audit so the rollout can match their service model, approval load,
                  and client portfolio.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-xl border border-border/80 bg-card p-6 shadow-card">
                  <LockKeyhole className="h-6 w-6 text-primary" />
                  <h3 className="mt-5 font-display text-2xl font-semibold">Strategy Audit</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Map your operating model, identify bottlenecks, and define the governed AI rollout path.
                  </p>
                  <Button asChild className="mt-6 w-full">
                    <a
                      href={CAL_LINK}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => track("cta_book_strategy_audit_click", { location: "pricing" })}
                    >
                      Book audit
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </article>
                <article className="rounded-xl border border-primary/30 bg-primary/10 p-6 shadow-card">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <h3 className="mt-5 font-display text-2xl font-semibold">Rollout plan</h3>
                  <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                    {["Agency expertise setup", "Client operating layer", "Approval workflow", "Dashboard and reporting"].map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" className="mt-6 w-full">
                    <a href="/pricing" onClick={() => track("pricing_view_click", { location: "pricing" })}>
                      See plans
                    </a>
                  </Button>
                </article>
              </div>
            </div>
          </LandingShell>
        </section>

        <section className="py-16 md:py-24">
          <LandingShell>
            <div className="rounded-2xl border border-border/80 bg-card p-8 shadow-panel md:p-12">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <Badge variant="secondary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Founder-led rollout
                  </Badge>
                  <h2 className="mt-5 section-title">Give your clients a calmer, more premium agency experience.</h2>
                  <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
                    Keep the strategy and approvals under control while SMMAHUB handles the operating context around the work.
                  </p>
                </div>
                <Button asChild size="lg">
                  <a
                    href={CAL_LINK}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("cta_book_strategy_audit_click", { location: "final_cta" })}
                  >
                    Book strategy audit
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </LandingShell>
        </section>
      </main>

      <footer className="border-t border-border/70 py-8">
        <LandingShell>
          <div className="flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div className="font-display text-base font-semibold text-foreground">SMMAHUB</div>
            <div className="flex flex-wrap gap-5">
              <a href="/auth" className="hover:text-foreground focus-ring">
                Sign in
              </a>
              <a href="/pricing" className="hover:text-foreground focus-ring">
                Pricing
              </a>
              <a href="/privacy" className="hover:text-foreground focus-ring">
                Privacy
              </a>
              <a href="/terms" className="hover:text-foreground focus-ring">
                Terms
              </a>
            </div>
          </div>
        </LandingShell>
      </footer>
    </div>
  );
}
