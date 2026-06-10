import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleSlash,
  Layers3,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";

const CAL_LINK = marketing.calUrl;

const plans = [
  {
    name: "Operate",
    price: "€199",
    interval: "/month",
    description: "For an established agency standardizing delivery across up to roughly 10 active clients.",
    features: [
      "Agency expertise and guardrail setup",
      "Client context hub for active retainers",
      "Approval workflow and operating visibility",
      "Premium client-facing collaboration layer",
    ],
  },
  {
    name: "Scale",
    price: "€349",
    interval: "/month",
    description: "For a growing multi-seat team carrying more client volume and approval load.",
    features: [
      "Everything in Operate",
      "Expanded workflow coverage for up to roughly 25 clients",
      "Team operating visibility across accounts",
      "Governed AI support for recurring delivery decisions",
    ],
    featured: true,
  },
  {
    name: "Agency",
    price: "€499",
    interval: "/month",
    description: "For higher-volume agencies that need advanced governance and deeper rollout support.",
    features: [
      "Everything in Scale",
      "Advanced governance and escalation design",
      "Higher-volume client rollout planning",
      "Custom operating review with the founder team",
    ],
  },
];

const auditSteps = [
  {
    icon: Workflow,
    title: "Map the operating model",
    body: "We review how client context, approvals, reporting, and delivery decisions move through your agency today.",
  },
  {
    icon: ShieldCheck,
    title: "Define governance",
    body: "We identify what AI can draft, what needs owner review, and where escalation rules protect client trust.",
  },
  {
    icon: Layers3,
    title: "Scope the rollout",
    body: "You leave with a realistic rollout path matched to client volume, team structure, and the work worth systemizing first.",
  },
];

const fitCriteria = [
  "5-25 active client accounts",
  "€15k-€100k/month in agency revenue",
  "2-10 person team with recurring delivery",
  "Owner bottleneck or account-manager context drag",
];

function PricingShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">{children}</div>;
}

export default function Pricing() {
  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <a href="#main" className="skip-to-content">
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <PricingShell>
          <nav className="flex h-16 items-center justify-between gap-4" aria-label="Primary">
            <a href="/" className="flex items-center gap-3 rounded-md focus-ring">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers3 className="h-4 w-4" />
              </div>
              <span className="font-display text-lg font-bold">SMMAHUB</span>
            </a>

            <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
              <a href="/#system" className="rounded-md transition-colors hover:text-foreground focus-ring">
                System
              </a>
              <a href="/#proof" className="rounded-md transition-colors hover:text-foreground focus-ring">
                Fit
              </a>
              <a href="/#pricing" className="rounded-md transition-colors hover:text-foreground focus-ring">
                Landing
              </a>
            </div>

            <Button asChild size="sm">
              <a
                href={CAL_LINK}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("cta_book_strategy_audit_click", { location: "pricing_nav" })}
              >
                Book strategy audit
              </a>
            </Button>
          </nav>
        </PricingShell>
      </header>

      <main id="main">
        <section className="border-b border-border/70 py-16 md:py-24">
          <PricingShell>
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <Badge variant="secondary" className="mb-5">
                  Infrastructure from €199/month
                </Badge>
                <h1 className="font-display text-h1-mobile text-foreground md:text-h1">
                  Pricing for established agencies standardizing delivery.
                </h1>
                <p className="mt-6 max-w-[68ch] text-lg leading-8 text-muted-foreground">
                  SMMAHUB is sold as agency operating infrastructure, not a cheap content app. Plans start at €199/month,
                  and every serious evaluation begins with a strategy audit so the rollout matches your clients, team,
                  and approval load.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <a
                      href={CAL_LINK}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => track("cta_book_strategy_audit_click", { location: "pricing_hero" })}
                    >
                      Book strategy audit
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <a href="/" onClick={() => track("pricing_back_to_landing_click", { location: "pricing_hero" })}>
                      <ArrowLeft className="h-4 w-4" />
                      Back to landing
                    </a>
                  </Button>
                </div>
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/70 bg-muted/30">
                  <CardTitle>Who should book the audit</CardTitle>
                  <CardDescription>
                    Built for operators with enough delivery complexity to make governance valuable.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <ul className="space-y-3">
                    {fitCriteria.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 rounded-lg border border-border/70 bg-background/50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CircleSlash className="h-4 w-4 text-primary" />
                      No free plan, no beginner tier.
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Solo freelancers, first-client agencies, and discount seekers are not the target buyer.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </PricingShell>
        </section>

        <section className="border-b border-border/70 py-16 md:py-24">
          <PricingShell>
            <div className="max-w-3xl">
              <div className="page-eyebrow">Indicative plans</div>
              <h2 className="mt-3 section-title">Choose the infrastructure level after fit is confirmed.</h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                These tiers frame budget and scope. The strategy audit confirms the right starting point before rollout.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <Card
                  key={plan.name}
                  className={plan.featured ? "border-primary/40 bg-primary/10 shadow-panel" : "bg-card"}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.featured ? <Badge variant="secondary">Common fit</Badge> : null}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="pt-4">
                      <span className="font-display text-4xl font-bold text-primary">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">{plan.interval}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="mt-6 w-full" variant={plan.featured ? "default" : "outline"}>
                      <a
                        href={CAL_LINK}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => track("cta_book_strategy_audit_click", { location: `pricing_plan_${plan.name.toLowerCase()}` })}
                      >
                        Book strategy audit
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </PricingShell>
        </section>

        <section className="border-b border-border/70 py-16 md:py-24">
          <PricingShell>
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <div className="page-eyebrow">Strategy audit</div>
                <h2 className="mt-3 section-title">The audit is the top of funnel.</h2>
                <p className="mt-5 text-lg leading-8 text-muted-foreground">
                  The goal is not to push a self-serve checkout. It is to decide where governed AI and client operating
                  infrastructure will actually remove drag from your agency.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {auditSteps.map((step) => (
                  <Card key={step.title}>
                    <CardHeader>
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <step.icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-xl">{step.title}</CardTitle>
                      <CardDescription>{step.body}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </PricingShell>
        </section>

        <section className="py-16 md:py-24">
          <PricingShell>
            <div className="rounded-2xl border border-border/80 bg-card p-8 shadow-panel md:p-12">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <Badge variant="secondary">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Founder-led evaluation
                  </Badge>
                  <h2 className="mt-5 section-title">Start with fit, then roll out the operating system.</h2>
                  <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
                    Bring the current Slack, Docs, approval, and reporting reality. The audit translates that into a
                    governed rollout plan.
                  </p>
                </div>
                <Button asChild size="lg">
                  <a
                    href={CAL_LINK}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("cta_book_strategy_audit_click", { location: "pricing_final_cta" })}
                  >
                    Book strategy audit
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </PricingShell>
        </section>
      </main>

      <footer className="border-t border-border/70 py-8">
        <PricingShell>
          <div className="flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div className="font-display text-base font-semibold text-foreground">SMMAHUB</div>
            <div className="flex flex-wrap gap-5">
              <a href="/" className="hover:text-foreground focus-ring">
                Landing
              </a>
              <a href="/privacy" className="hover:text-foreground focus-ring">
                Privacy
              </a>
              <a href="/terms" className="hover:text-foreground focus-ring">
                Terms
              </a>
            </div>
          </div>
        </PricingShell>
      </footer>
    </div>
  );
}
