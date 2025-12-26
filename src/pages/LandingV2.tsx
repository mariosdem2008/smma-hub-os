import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  ShieldCheck,
  Database,
  Sparkles,
  Layers,
  MessageSquare,
  Workflow,
  Users,
  FileText,
  Zap,
  Check,
  Lock,
} from "lucide-react";

const CAL_LINK = "https://cal.com/SMMAHUB/fit";
const LOOM_LINK = "https://loom.com/share/LOOM_ID";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Safety", href: "#safety" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const HERO_OUTCOMES = [
  "Manage 2x more clients without hiring more staff",
  "Save 15+ hours per client monthly on repetitive work",
  "Scale your agency while maintaining consistent quality",
  "Onboard new clients faster with proven processes",
];

const PROBLEM_POINTS = [
  {
    title: "Can't scale without hiring",
    desc: "Every new client means more work, more employees, and more management overhead.",
  },
  {
    title: "Process inconsistencies",
    desc: "Different team members handle clients differently, causing quality fluctuations.",
  },
  {
    title: "Time wasted on repeat tasks",
    desc: "Your team spends hours on onboarding, strategy building, and content creation from scratch.",
  },
  {
    title: "Knowledge trapped in heads",
    desc: "Client preferences and successful strategies live in team members' memories, not in reusable systems.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Capture your proven processes",
    desc: "Upload your successful strategies, SOPs, and client playbooks once. The AI learns how you work.",
  },
  {
    step: "02",
    title: "Automate client work",
    desc: "AI applies your processes consistently across all clients, creating strategies and content that match your standards.",
  },
  {
    step: "03",
    title: "Scale without adding headcount",
    desc: "Take on more clients while your team focuses on high-value creative direction and client relationships.",
  },
];

const ABILITIES = [
  {
    title: "Automated Client Onboarding",
    desc: "Consistent intake process that captures everything needed, following your proven SOPs.",
    icon: Layers,
  },
  {
    title: "Strategy Generation Engine",
    desc: "Creates client-specific strategies based on your successful approaches and their business goals.",
    icon: Sparkles,
  },
  {
    title: "Content Creation Assistant",
    desc: "Drafts captions, scripts, and plans that start aligned with client voice and your agency standards.",
    icon: Zap,
  },
  {
    title: "Client Knowledge Base",
    desc: "Remembers every client preference, approval, and successful approach for consistent delivery.",
    icon: Database,
  },
  {
    title: "Standby Assistant",
    desc: "Answers client questions based on approved information, available 24/7 through client portal.",
    icon: MessageSquare,
  },
  {
    title: "Workflow Automation",
    desc: "Streamlines review → approval → execution cycles so nothing falls through the cracks.",
    icon: Workflow,
  },
];

const SAFETY = [
  {
    title: "No guessing policy",
    desc: "If the AI doesn't have approved information, it says UNKNOWN instead of inventing answers.",
    icon: ShieldCheck,
  },
  {
    title: "Client data isolation",
    desc: "Each client's data is completely separate and secure, never shared between accounts.",
    icon: Lock,
  },
  {
    title: "Approval-based learning",
    desc: "Only learns from content and strategies you explicitly approve, maintaining your quality standards.",
    icon: FileText,
  },
];

const PLANS = [
  {
    name: "Free/Trial",
    price: "$0",
    line: "3 clients · 1 user · 5 GB",
    desc: "Test drive with a few clients and prove the time savings.",
  },
  {
    name: "Starter",
    price: "$399",
    line: "10 clients · 3 users · 50 GB",
    desc: "For agencies ready to systemize and scale their operations.",
  },
  {
    name: "Growth",
    price: "$799",
    line: "25 clients · 5 users · 200 GB",
    desc: "For growing agencies managing multiple clients efficiently.",
  },
  {
    name: "Scale/Pro",
    price: "$1,299",
    line: "Unlimited clients · 10 users · 500 GB",
    desc: "For established agencies scaling to the next level.",
    highlight: true,
  },
];

const ADDONS = [
  "Extra storage",
  "Extra clients",
  "Extra users",
  "Extra platforms",
];

const FAQS = [
  {
    q: "How much time will this actually save?",
    a: "Pilot agencies report saving 15-20 hours per client monthly on repetitive tasks like onboarding, strategy building, and content drafting. This frees your team to focus on creative direction and client relationships.",
  },
  {
    q: "Does this replace my employees?",
    a: "No—it replaces repetitive tasks, not people. Your team moves from doing repetitive work to overseeing quality, building client relationships, and strategic thinking. Most agencies use the time savings to take on more clients without hiring.",
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
    q: "How is data safety handled?",
    a: "Each agency and client workspace is completely isolated. Client data never mixes between accounts. For detailed security posture, discuss your requirements during the fit call.",
  },
  {
    q: "Will our clients notice we're using AI?",
    a: "They'll notice better consistency, faster turnaround, and more strategic focus. The AI works behind the scenes following your approved processes—your team maintains control and final approval over everything.",
  },
  {
    q: "How difficult is setup?",
    a: "Start with one client and one proven strategy. Upload what already works for you. The system guides you through the rest. Most agencies are fully operational within a week.",
  },
  {
    q: "What's the actual ROI?",
    a: "At minimum, you save one full-time employee's worth of repetitive work. This means you can either: 1) Manage more clients without hiring, or 2) Reduce overhead while maintaining current client load. Most agencies achieve both.",
  },
  {
    q: "Which platforms are supported?",
    a: "This landing doesn't assume platform coverage beyond your current workflow. If you use calendars/approvals for Instagram/Facebook/LinkedIn today, SMMAHUB fits that. Treat additional platforms as add-ons when available.",
  },
  {
    q: "Do you guarantee performance results?",
    a: "We guarantee operational efficiency: consistent processes, time savings, and scalable workflows. Marketing performance depends on your strategies, creative, and execution—which SMMAHUB helps you deliver more consistently.",
  },
];

function AnchorNav() {
  return (
    <nav className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
        <a href="#top" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">SMMAHUB</span>
        </a>

        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <a href={LOOM_LINK} target="_blank" rel="noreferrer">
              Watch demo
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={CAL_LINK} target="_blank" rel="noreferrer">
              Book 15-min call
            </a>
          </Button>
        </div>
      </div>
    </nav>
  );
}

export default function LandingV2() {
  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <AnchorNav />

      {/* 1) Hero - Refocused on benefits */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-56 right-[-200px] h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <Badge className="mb-5" variant="secondary">
                  For social media marketing agencies
                </Badge>

                <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                  Agencies Game Changer
                </h1>

                <p className="mt-6 text-lg text-muted-foreground">
                  Scale your agency without the overhead. Save hours of repetitive work and replace at least one FTE with an AI system that applies your proven processes consistently across all clients.
                </p>

                <div className="mt-6 grid gap-3">
                  {HERO_OUTCOMES.map((t) => (
                    <div key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <a href={CAL_LINK} target="_blank" rel="noreferrer">
                      See how much time you'll save <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                    <a href={LOOM_LINK} target="_blank" rel="noreferrer">
                      Watch 6-min demo
                    </a>
                  </Button>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  Pilot agencies save 15+ hours per client monthly
                </p>
              </div>

              <Card className="border bg-card/40">
                <CardHeader className="space-y-3">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    <Workflow className="h-4 w-4" />
                    Your new competitive advantage
                  </div>
                  <CardTitle className="text-2xl">The equivalent of a full-time employee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    While your competitors struggle with hiring and training, you'll scale efficiently with an AI Employee that works 24/7, never forgets a detail, and applies your best strategies consistently.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Time saved", value: "15-20 hours/client" },
                      { label: "Consistency", value: "Your proven SOPs" },
                      { label: "Scalability", value: "No hiring needed" },
                      { label: "Availability", value: "24/7 standby" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border bg-background/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-2 font-medium text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </header>

      {/* 2) Social proof strip */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-4 py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
            <div className="text-center md:text-left">
              <p className="text-sm font-semibold text-muted-foreground">Agencies scaling with SMMAHUB</p>
              <p className="mt-1 text-xs text-muted-foreground">Managing 2x more clients without adding staff</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 w-28 rounded-lg border bg-card/50"
                  aria-label="Pilot agency logo placeholder"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3) Problem */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">The scaling problem</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your agency is stuck between growth and overhead
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every new client means more repetitive work, more hiring, and more management complexity. You're trading your time for revenue instead of building a scalable business.
            </p>

            <div className="mt-8 grid gap-4">
              {PROBLEM_POINTS.map((x) => (
                <div key={x.title} className="flex gap-3 rounded-2xl border bg-card/30 p-4">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{x.title}</p>
                    <p className="text-sm text-muted-foreground">{x.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border bg-muted/30 p-6">
              <p className="text-sm font-semibold text-foreground">The opportunity cost</p>
              <p className="mt-2 text-sm text-muted-foreground">
                While you're managing repetitive tasks, your competitors are building strategic partnerships and taking your clients. The agency that scales efficiently wins.
              </p>
            </div>
          </div>

          <Card className="border bg-card/40">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Before vs After SMMAHUB</CardTitle>
              <p className="text-sm text-muted-foreground">
                How efficient agencies operate vs those stuck in manual work
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { left: "Hire for every 3 new clients", right: "Add 10+ clients with same team" },
                { left: "Quality varies by employee", right: "Consistent quality across all work" },
                { left: "Client knowledge walks out", right: "All knowledge captured & reused" },
                { left: "Reactive client service", right: "Proactive strategic partnership" },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-background/40 p-3 text-muted-foreground">{row.left}</div>
                  <div className="rounded-xl border bg-background/40 p-3 font-medium">{row.right}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* 4) How it works */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Systemize once, scale forever
            </h2>
            <p className="mt-4 text-muted-foreground">
              Capture what makes your agency successful, then let the AI apply it consistently across all clients.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <Card key={s.step} className="border bg-card/40">
                <CardHeader className="space-y-2">
                  <div className="text-xs font-semibold tracking-[0.28em] text-muted-foreground">STEP {s.step}</div>
                  <CardTitle className="text-xl">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 5) Abilities - Now positioned as "How you save time" */}
      <section id="product" className="bg-muted/30">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">How you save time</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Automate the repetitive, focus on the strategic
              </h2>
              <p className="mt-4 text-muted-foreground">
                Your team stops doing manual work and starts doing what actually grows your agency.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {ABILITIES.map((m) => (
                <Card key={m.title} className="border bg-card/45">
                  <CardHeader className="space-y-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                      <m.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{m.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{m.desc}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Rest of the page remains the same */}
      {/* 6) Safety */}
      <section id="safety" className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Safety</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Guardrails that protect your agency and your clients.
            </h2>
            <p className="mt-4 text-muted-foreground">
              The difference between "AI drafts" and an AI Employee your agency can trust.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {SAFETY.map((x) => (
              <Card key={x.title} className="border bg-card/45">
                <CardHeader className="space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                    <x.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{x.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{x.desc}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 7) Screenshots */}
      <section className="bg-muted/30">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Demo</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Screenshots (placeholders)</h2>
              <p className="mt-4 text-muted-foreground">
                Replace these with real product shots when ready: [Screenshots].
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                { title: "Onboarding", desc: "Capture goals, tone, offers, constraints, and approvals in one flow." },
                { title: "Brain Summary", desc: "A client-ready summary that becomes the reference for the whole team." },
                { title: "Strategy Output", desc: "Themes, angles, and plans generated from approved context." },
              ].map((card) => (
                <Card key={card.title} className="border bg-card/45">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{card.desc}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed bg-background/40 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                      [Screenshots]
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8) Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Pay for results, not software
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every dollar spent should return as time saved and clients added.
            </p>
          </div>

          <div className="mt-10 rounded-3xl border bg-card/40 p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">Calculate your ROI first</p>
                <p className="text-sm text-muted-foreground">
                  Most agencies save $4,000+ monthly in avoided hiring costs. Let's calculate your specific savings.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Pilot agencies typically see full ROI in 30 days</p>
              </div>
              <Button asChild>
                <a href={CAL_LINK} target="_blank" rel="noreferrer">
                  Calculate your savings
                </a>
              </Button>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-4">
            {PLANS.map((p) => (
              <Card
                key={p.name}
                className={`border bg-card/40 ${p.highlight ? "ring-1 ring-primary/30" : ""}`}
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    {p.highlight ? <Badge variant="secondary">Most chosen</Badge> : null}
                  </div>
                  <div className="text-3xl font-semibold tracking-tight">{p.price}</div>
                  <div className="text-sm text-muted-foreground">{p.line}</div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{p.desc}</CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border bg-card/40 p-8">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold">Add-ons (no invented prices)</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {ADDONS.map((a) => (
                    <li key={a} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <Button asChild size="lg">
                  <a href={CAL_LINK} target="_blank" rel="noreferrer">
                    Book a 15-min fit call
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href={LOOM_LINK} target="_blank" rel="noreferrer">
                    Watch 6-min demo
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9) FAQ */}
      <section id="faq" className="bg-muted/30">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">FAQ</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                The questions agencies ask before scaling efficiently
              </h2>
              <p className="mt-4 text-muted-foreground">Direct answers about time savings and scalability.</p>
            </div>

            <div className="mx-auto mt-10 max-w-3xl">
              <Accordion type="single" collapsible className="space-y-3">
                {FAQS.map((f, i) => (
                  <AccordionItem
                    key={f.q}
                    value={`faq-${i}`}
                    className="rounded-2xl border bg-card/45 px-4"
                  >
                    <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* 10) Final CTA block */}
            <div className="mt-14 rounded-3xl border bg-card/45 p-10 text-center">
              <Badge variant="secondary" className="mb-4">
                Ready to scale efficiently?
              </Badge>
              <h3 className="text-3xl font-semibold tracking-tight">
                Stop trading time for revenue. Start scaling your agency.
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Book a 15-minute fit call. We'll calculate exactly how much time you'll save and how many more clients you can manage with your current team.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <a href={CAL_LINK} target="_blank" rel="noreferrer">
                    Calculate your savings <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <a href={LOOM_LINK} target="_blank" rel="noreferrer">
                    Watch 6-min demo
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Footer */}
      <footer className="container mx-auto px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold">SMMAHUB</div>
              <div className="text-xs text-muted-foreground">Scale your agency without the overhead</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <span>contact@smmahub.com</span>
          </div>

          <div className="text-xs text-muted-foreground">© 2025 SMMAHUB</div>
        </div>
      </footer>
    </div>
  );
}