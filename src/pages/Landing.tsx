import { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HeroMockup from "@/components/mockups/HeroMockup";
import ClientCommandMockup from "@/components/mockups/ClientCommandMockup";
import CalendarMockup from "@/components/mockups/CalendarMockup";
import TeamMockup from "@/components/mockups/TeamMockup";
import MobileMockup from "@/components/mockups/MobileMockup";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LayoutGrid,
  Zap,
  Users,
  Palette,
  Lightbulb,
  FolderOpen,
  Image as ImageIcon,
  Calendar,
  Upload,
  Target,
  CheckCircle2,
  ArrowRight,
  Play,
  ShoppingBag,
  Building2,
  Heart,
  Dumbbell,
  Instagram,
  Facebook,
  Linkedin,
} from "lucide-react";
import { PLAN_NAMES, PLAN_PRICES } from "@/lib/plan-limits";
import { WaitlistModal } from "@/components/WaitlistModal";
import { LaunchCountdown } from "@/components/LaunchCountdown";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5 },
  },
};

const fadeInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5 },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};

// Reusable animation wrapper component
const AnimatedSection = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default function Landing() {
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Parallax effect for hero image
  const heroImageY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2"
          >
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <LayoutGrid className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-primary">SMMAHUB</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <Button onClick={() => setShowWaitlistModal(true)}>Join Waitlist</Button>
          </motion.div>
        </div>
      </nav>

      {/* SECTION 1 - HERO */}
      <section ref={heroRef} className="relative overflow-hidden py-20 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5">
                  <Zap className="mr-2 h-3 w-3" />
                  Early Access + 20% Lifetime Discount
                </Badge>
              </motion.div>

              <motion.h1
                className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                All Your Client Files, Brand Assets & Content <span className="text-primary">In One Place</span>
              </motion.h1>

              <motion.p
                className="mb-8 text-lg sm:text-xl text-muted-foreground leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Auto-post to Instagram, Facebook & LinkedIn. Store brand guidelines, manage raw footage, share edited
                content — everything your editors and clients need, organized and automated.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mb-8"
              >
                <LaunchCountdown />
              </motion.div>

              <motion.div
                className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                >
                  <Button
                    size="lg"
                    className="text-base px-8 shadow-lg hover:shadow-xl transition-shadow"
                    onClick={() => setShowWaitlistModal(true)}
                  >
                    Get Early Access + 20% Off
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.8 }}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-base px-8"
                    onClick={() => setShowVideoDialog(true)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Watch Demo
                  </Button>
                </motion.div>
              </motion.div>

              {/* Trust Badges */}
              <motion.div
                className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 sm:gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.0 }}
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Auto-posts to Instagram, Facebook & LinkedIn</span>
                </div>
                <div className="hidden sm:block text-muted-foreground">•</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>No credit card required</span>
                </div>
              </motion.div>
            </div>

            {/* Right Column - Hero Mockup */}
            <div>
              <HeroMockup />
            </div>
          </div>

          {/* Mobile Mockup - Below Hero */}
          <div className="mt-20 lg:hidden">
            <MobileMockup />
          </div>
        </div>
      </section>

      {/* SECTION 2 - PROOF BAR */}
      <AnimatedSection>
        <section className="border-y bg-muted/30 py-12">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center gap-8">
              <motion.p variants={fadeInUp} className="text-sm font-medium text-muted-foreground">
                Purpose-built for agencies managing 10–100+ client brands
              </motion.p>

              <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-4xl">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">10K+</div>
                  <div className="text-sm text-muted-foreground">Hours Saved</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">3</div>
                  <div className="text-sm text-muted-foreground">Platforms Connected</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">24/7</div>
                  <div className="text-sm text-muted-foreground">Auto-Posting</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">100%</div>
                  <div className="text-sm text-muted-foreground">Organized Files</div>
                </div>
              </motion.div>

              <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-5 w-5" />
                  <span className="text-sm">Real Estate</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="h-5 w-5" />
                  <span className="text-sm">E-commerce</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Heart className="h-5 w-5" />
                  <span className="text-sm">Beauty</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Dumbbell className="h-5 w-5" />
                  <span className="text-sm">Fitness</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* SECTION 3 - CORE BENEFITS */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <div className="mb-12 text-center">
              <motion.h2 variants={fadeInUp} className="mb-4 text-3xl font-bold sm:text-4xl">
                Why Agencies Choose SMMAHUB
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to manage clients, content, and team in one place — no more juggling Google Drive,
                spreadsheets, and scheduling tools
              </motion.p>
            </div>
          </AnimatedSection>

          <AnimatedSection className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: FolderOpen,
                title: "Centralized Client Hub",
                description:
                  "Every client's files, brand assets, guidelines, and notes organized in dedicated workspaces. Editors find what they need instantly.",
              },
              {
                icon: Upload,
                title: "Seamless File Management",
                description:
                  "Upload raw footage, share edited content, store brand assets. Everything accessible to your team and clients when they need it.",
              },
              {
                icon: Target,
                title: "Auto-Post Everywhere",
                description:
                  "Schedule once, post to Instagram, Facebook & LinkedIn automatically. Save hours of manual posting every week.",
              },
              {
                icon: Palette,
                title: "Brand Guidelines Storage",
                description:
                  "Store colors, fonts, tone of voice, and brand rules. Your entire team stays on-brand for every client.",
              },
              {
                icon: Users,
                title: "Team Collaboration",
                description:
                  "Assign roles, share feedback, and collaborate in real-time. Everyone knows what to work on and when it's due.",
              },
              {
                icon: Calendar,
                title: "Content Calendar",
                description:
                  "Plan and visualize all client content in one unified calendar. Never miss a deadline or double-book a slot.",
              },
            ].map((benefit, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="border hover:border-primary/50 transition-all duration-200 hover:shadow-lg h-full">
                  <CardHeader>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{benefit.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">{benefit.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* SECTION 4 - FEATURE SHOWCASE */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="space-y-32">
            {/* Feature 1 - Client Command Center */}
            <AnimatedSection>
              <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
                <motion.div variants={fadeInLeft} className="order-2 lg:order-1">
                  <Badge className="mb-4">Client Workspaces</Badge>
                  <h3 className="mb-4 text-3xl font-bold">Everything Your Editors Need to Execute</h3>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Give every client a dedicated workspace with brand guidelines, asset library, content ideas, and
                    file sharing — all in one place. No more "where's that file?" messages.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Brand colors, fonts, tone of voice & guidelines</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Raw footage uploads & edited content storage</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Asset library with instant search & preview</span>
                    </li>
                  </ul>
                </motion.div>
                <motion.div variants={fadeInRight} className="order-1 lg:order-2">
                  <ClientCommandMockup />
                </motion.div>
              </div>
            </AnimatedSection>

            {/* Feature 2 - Content Calendar */}
            <AnimatedSection>
              <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
                <motion.div variants={fadeInLeft}>
                  <CalendarMockup />
                </motion.div>
                <motion.div variants={fadeInRight}>
                  <Badge className="mb-4">Auto-Posting</Badge>
                  <h3 className="mb-4 text-3xl font-bold">Schedule Once, Post Everywhere</h3>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Connect your clients' Instagram, Facebook & LinkedIn accounts. Schedule content once and let SMMAHUB
                    auto-post at the perfect time — no manual posting required.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Auto-post to Instagram, Facebook & LinkedIn</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Unified calendar for all clients & platforms</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Timezone-aware scheduling</span>
                    </li>
                  </ul>
                </motion.div>
              </div>
            </AnimatedSection>

            {/* Feature 3 - Mobile Mockup Showcase */}
            <AnimatedSection>
              <div className="text-center mb-12">
                <Badge className="mb-4">Mobile First</Badge>
                <h3 className="mb-4 text-3xl font-bold">Manage Your Agency On The Go</h3>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Full mobile experience with native-like performance. Access clients, schedule posts, and collaborate
                  with your team from anywhere.
                </p>
              </div>
              <div className="flex justify-center">
                <MobileMockup />
              </div>
            </AnimatedSection>

            {/* Feature 4 - Team Collaboration */}
            <AnimatedSection>
              <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
                <motion.div variants={fadeInLeft} className="order-2 lg:order-1">
                  <Badge className="mb-4">Collaboration</Badge>
                  <h3 className="mb-4 text-3xl font-bold">Team Collaboration Made Easy</h3>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Invite team members, set granular permissions, and collaborate seamlessly across all your client
                    projects.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Role-based access control</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Easy team invite system</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Shared workflows and templates</span>
                    </li>
                  </ul>
                </motion.div>
                <motion.div variants={fadeInRight} className="order-1 lg:order-2">
                  <TeamMockup />
                </motion.div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* SECTION 5 - VIDEO DEMO */}
      <AnimatedSection>
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <motion.h2 variants={fadeInUp} className="mb-4 text-3xl font-bold sm:text-4xl">
                See SMMAHUB in Action
              </motion.h2>
              <motion.p variants={fadeInUp} className="mb-8 text-lg text-muted-foreground">
                Watch how agencies use SMMAHUB to scale their operations (60 seconds)
              </motion.p>
              <motion.div variants={fadeInUp}>
                <Card
                  className="cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-200 hover:scale-[1.02] group"
                  onClick={() => setShowVideoDialog(true)}
                >
                  <div className="aspect-video bg-muted flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-colors" />
                    <Button size="lg" className="relative z-10 gap-2">
                      <Play className="h-5 w-5" />
                      Watch Demo
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* SECTION 5.5 - URGENCY/EARLY ACCESS BANNER */}
      <AnimatedSection>
        <section className="py-16 bg-primary/5 border-y border-primary/20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div variants={fadeInUp} className="mb-6">
                <Badge
                  variant="secondary"
                  className="text-sm px-4 py-2 mb-4 bg-primary/10 text-primary border-primary/20"
                >
                  Limited Time Offer
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Join the Waitlist, Get <span className="text-primary">20% Off for Life</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Be among the first to access SMMAHUB when we launch on December 23rd. Waitlist members get early
                  access and lock in a permanent 20% discount on any paid plan — forever.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" onClick={() => setShowWaitlistModal(true)} className="px-8 shadow-lg">
                    Get Early Access + 20% Off
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>No credit card required</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* SECTION 6 - PRICING */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <div className="mb-12 text-center">
              <motion.h2 variants={fadeInUp} className="mb-4 text-3xl font-bold sm:text-4xl">
                Simple, Transparent Pricing
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-lg text-muted-foreground mb-2">
                Start free, scale as you grow
              </motion.p>
              <motion.p variants={fadeInUp} className="text-sm text-primary font-medium">
                Waitlist members get 20% off any paid plan — for life 🎉
              </motion.p>
            </div>
          </AnimatedSection>

          <AnimatedSection className="grid gap-8 lg:grid-cols-4 mx-auto max-w-7xl">
            {[
              {
                name: PLAN_NAMES.free,
                price: 0,
                currency: "Free",
                features: [
                  "1 client workspace",
                  "3 team members",
                  "10GB storage",
                  "Unlimited scheduled posts",
                  "All tools unlocked",
                  "Analytics (7 days)",
                ],
              },
              {
                name: PLAN_NAMES.starter,
                price: PLAN_PRICES.starter.monthly,
                currency: PLAN_PRICES.starter.currency,
                features: [
                  "Up to 3 clients",
                  "Up to 5 team members",
                  "100GB storage",
                  "Full analytics",
                  "Bulk scheduling",
                  "Templates library",
                ],
              },
              {
                name: PLAN_NAMES.pro,
                price: PLAN_PRICES.pro.monthly,
                currency: PLAN_PRICES.pro.currency,
                features: [
                  "Up to 10 clients",
                  "Up to 10 team members",
                  "500GB storage",
                  "White-label",
                  "Approval workflows",
                  "Advanced automation",
                ],
                popular: true,
              },
              {
                name: PLAN_NAMES.agency_plus,
                price: PLAN_PRICES.agency_plus.monthly,
                currency: PLAN_PRICES.agency_plus.currency,
                features: [
                  "Unlimited clients",
                  "Unlimited team members",
                  "2TB storage",
                  "Multi-admin",
                  "Dedicated support",
                  "Priority features",
                ],
              },
            ].map((tier, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card
                  className={`flex flex-col h-full transition-all duration-200 hover:shadow-xl hover:scale-[1.02] ${
                    tier.popular ? "border-primary border-2" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{tier.name}</CardTitle>
                      {tier.popular && <Badge className="bg-primary">Most Popular</Badge>}
                    </div>
                    <div className="mt-4">
                      {tier.price === 0 ? (
                        <span className="text-4xl font-bold">Free</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold">€{tier.price}</span>
                          <span className="text-muted-foreground">/month</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={tier.popular ? "default" : "outline"}
                      onClick={() => setShowWaitlistModal(true)}
                    >
                      {tier.price === 0 ? "Join Waitlist" : "Get 20% Off"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* SECTION 7 - FAQ */}
      <AnimatedSection>
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <motion.div variants={fadeInUp} className="mb-12 text-center">
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Frequently Asked Questions</h2>
                <p className="text-lg text-muted-foreground">Everything you need to know about SMMAHUB</p>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Accordion type="single" collapsible className="w-full">
                  {[
                    {
                      q: "What do I get as a waitlist member?",
                      a: "Waitlist members get exclusive early access on December 23rd, 2025, plus a permanent 20% lifetime discount on any paid plan. This discount applies forever — as long as you maintain your subscription.",
                    },
                    {
                      q: "When does SMMAHUB launch?",
                      a: "SMMAHUB officially launches on December 23rd, 2025. Waitlist members will receive early access and onboarding instructions via email before the public launch.",
                    },
                    {
                      q: "Is SMMAHUB replacing Notion or other tools?",
                      a: "SMMAHUB is purpose-built for social media agencies. While Notion is great for general productivity, SMMAHUB offers specialized features like content calendars, asset libraries, and client-specific workspaces that are tailored for SMMA workflows.",
                    },
                    {
                      q: "Can I invite my team members?",
                      a: "Yes! You can invite up to 3 team members on Freemium, 5 on Starter, 10 on Pro, and unlimited on Agency Plus, with role-based permissions to control access to clients and features.",
                    },
                    {
                      q: "Which social platforms are supported?",
                      a: "Currently, SMMAHUB supports auto-posting to Instagram, Facebook, and LinkedIn. We're actively working on TikTok and YouTube integrations.",
                    },
                    {
                      q: "How many clients can I manage?",
                      a: "It depends on your plan: Freemium (1 client), Starter (3 clients), Pro (10 clients), Agency Plus (unlimited clients).",
                    },
                    {
                      q: "Is my data secure?",
                      a: "Absolutely. All data is encrypted, backed up regularly, and stored on secure servers. We follow industry best practices and are compliant with GDPR regulations.",
                    },
                    {
                      q: "Can I cancel anytime?",
                      a: "Yes, you can cancel your subscription at any time. If you joined from the waitlist, you'll still keep your 20% discount if you ever decide to reactivate.",
                    },
                  ].map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </motion.div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* SECTION 8 - FINAL CTA */}
      <AnimatedSection>
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div variants={fadeInUp} className="mx-auto max-w-3xl text-center">
              <h2 className="mb-6 text-3xl font-bold sm:text-5xl leading-tight">
                Stop Losing Hours to Disorganized Workflows
              </h2>
              <p className="mb-8 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Join the waitlist to get <strong className="text-foreground">early access on December 23rd</strong> plus
                a <strong className="text-primary">20% lifetime discount</strong> on any plan. No credit card needed.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <Button
                  size="lg"
                  className="text-base px-8 shadow-lg hover:shadow-xl transition-shadow"
                  onClick={() => setShowWaitlistModal(true)}
                >
                  Get Early Access + 20% Off
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="text-base px-8" onClick={() => setShowVideoDialog(true)}>
                  <Play className="mr-2 h-4 w-4" />
                  Watch Demo
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>No credit card required</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Early access on Dec 23rd</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>20% off for life</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </AnimatedSection>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <LayoutGrid className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-primary">SMMAHUB</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2025 SMMAHUB. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Video Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>SMMAHUB Demo Video</DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Play className="mx-auto h-16 w-16 text-primary mb-4" />
              <p className="text-muted-foreground">Demo video placeholder</p>
              <p className="text-sm text-muted-foreground mt-2">Replace with actual video embed</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waitlist Modal */}
      <WaitlistModal open={showWaitlistModal} onOpenChange={setShowWaitlistModal} />
    </div>
  );
}
