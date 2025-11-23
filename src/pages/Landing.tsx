import { useState } from "react";
import { Link } from "react-router-dom";
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
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Linkedin
} from "lucide-react";
import { PLAN_NAMES, PLAN_PRICES } from "@/lib/plan-limits";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.5 }
  }
};

const fadeInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.5 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1
    }
  }
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
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
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
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started Free</Button>
            </Link>
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
                <Badge variant="secondary" className="mb-6 text-sm">
                  <Zap className="mr-2 h-3 w-3" />
                  The Operating System for Modern Agencies
                </Badge>
              </motion.div>

              <motion.h1 
                className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                The Operating System for{" "}
                <span className="text-primary">Modern Social Media Agencies</span>
              </motion.h1>

              <motion.p 
                className="mb-8 text-lg text-muted-foreground"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Run your entire agency — clients, content, branding, assets, inspiration, 
                calendar, and team — all in one powerful workspace.
              </motion.p>

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
                  <Link to="/auth">
                    <Button size="lg" className="text-base px-8">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
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
                className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.0 }}
              >
                <span className="flex items-center gap-2">
                  <Instagram className="h-4 w-4" /> Instagram
                </span>
                <span className="flex items-center gap-2">
                  <Facebook className="h-4 w-4" /> Facebook
                </span>
                <span className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </span>
                <span>& TikTok</span>
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
        <section className="border-y bg-muted/30 py-8">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center gap-6 text-center">
              <motion.p variants={fadeInUp} className="text-sm font-medium text-muted-foreground">
                Trusted by agencies managing 10–100+ client brands
              </motion.p>
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
                Everything You Need to Scale
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
                Purpose-built for social media marketing agencies
              </motion.p>
            </div>
          </AnimatedSection>

          <AnimatedSection className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: LayoutGrid,
                title: "Everything Organized",
                description: "Centralize clients, branding, assets, tasks, and social profiles in one place."
              },
              {
                icon: Zap,
                title: "Lightning-Fast Content Systems",
                description: "Ideas, pillars, calendar, saved captions — all connected and ready to use."
              },
              {
                icon: Users,
                title: "Team & Clients in One Workspace",
                description: "Invite your team, assign roles, collaborate in real time with full control."
              }
            ].map((benefit, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="border-2 hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] h-full">
                  <CardHeader>
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <benefit.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{benefit.title}</CardTitle>
                    <CardDescription className="text-base">
                      {benefit.description}
                    </CardDescription>
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
                  <Badge className="mb-4">Client Management</Badge>
                  <h3 className="mb-4 text-3xl font-bold">
                    Client Command Center
                  </h3>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Every client gets their own workspace with branding guidelines, ideas board, 
                    asset library, and inspiration panel — all customizable and organized.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Brand colors, voice, and guidelines</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Kanban-style ideas board</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Complete asset management system</span>
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
                  <Badge className="mb-4">Content Planning</Badge>
                  <h3 className="mb-4 text-3xl font-bold">
                    Powerful Content Calendar
                  </h3>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Plan, schedule, and track all your social media posts across multiple 
                    clients and platforms in a unified calendar view.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Monthly and weekly views</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Multi-platform scheduling</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <span>Status tracking and analytics</span>
                    </li>
                  </ul>
                </motion.div>
              </div>
            </AnimatedSection>

            {/* Feature 3 - Mobile Mockup Showcase */}
            <AnimatedSection>
              <div className="text-center mb-12">
                <Badge className="mb-4">Mobile First</Badge>
                <h3 className="mb-4 text-3xl font-bold">
                  Manage Your Agency On The Go
                </h3>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Full mobile experience with native-like performance. Access clients, 
                  schedule posts, and collaborate with your team from anywhere.
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
                  <h3 className="mb-4 text-3xl font-bold">
                    Team Collaboration Made Easy
                  </h3>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Invite team members, set granular permissions, and collaborate seamlessly 
                    across all your client projects.
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

      {/* SECTION 6 - PRICING */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <div className="mb-12 text-center">
              <motion.h2 variants={fadeInUp} className="mb-4 text-3xl font-bold sm:text-4xl">
                Simple, Transparent Pricing
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-lg text-muted-foreground">
                Start free, scale as you grow
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
                  "Analytics (7 days)"
                ]
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
                  "Templates library"
                ]
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
                  "Advanced automation"
                ],
                popular: true
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
                  "Priority features"
                ]
              }
            ].map((tier, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className={`flex flex-col h-full transition-all duration-200 hover:shadow-xl hover:scale-[1.02] ${
                  tier.popular ? 'border-primary border-2' : ''
                }`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{tier.name}</CardTitle>
                      {tier.popular && (
                        <Badge className="bg-primary">Most Popular</Badge>
                      )}
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
                    <Link to="/auth" className="block">
                      <Button className="w-full" variant={tier.popular ? "default" : "outline"}>
                        {tier.price === 0 ? "Get Started" : "Start Free Trial"}
                      </Button>
                    </Link>
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
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                  Frequently Asked Questions
                </h2>
                <p className="text-lg text-muted-foreground">
                  Everything you need to know about SMMAHUB
                </p>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Accordion type="single" collapsible className="w-full">
                  {[
                    {
                      q: "Is SMMAHUB replacing Notion or other tools?",
                      a: "SMMAHUB is purpose-built for social media agencies. While Notion is great for general productivity, SMMAHUB offers specialized features like content calendars, asset libraries, and client-specific workspaces that are tailored for SMMA workflows."
                    },
                    {
                      q: "Can I invite my team members?",
                      a: "Yes! You can invite up to 3 team members on Freemium, 5 on Starter, 10 on Pro, and unlimited on Agency Plus, with role-based permissions to control access to clients and features."
                    },
                    {
                      q: "How many clients can I manage?",
                      a: "It depends on your plan: Freemium (1 client), Starter (3 clients), Pro (10 clients), Agency Plus (unlimited clients)."
                    },
                    {
                      q: "Do you support AI-powered features?",
                      a: "Yes, SMMAHUB integrates AI capabilities for content suggestions, caption generation, and more. AI features are available on Pro and Agency+ plans."
                    },
                    {
                      q: "Is there a free trial?",
                      a: "Yes! All plans come with a 14-day free trial. No credit card required to start."
                    },
                    {
                      q: "Can I cancel anytime?",
                      a: "Absolutely. You can cancel your subscription at any time from your account settings. No long-term contracts or commitments."
                    },
                    {
                      q: "What payment methods do you accept?",
                      a: "We accept all major credit cards (Visa, Mastercard, American Express) and PayPal for your convenience."
                    },
                    {
                      q: "Do you offer custom enterprise solutions?",
                      a: "Yes! For agencies managing 50+ clients or requiring custom integrations, please contact our sales team for a tailored enterprise solution."
                    }
                  ].map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.a}
                      </AccordionContent>
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
            <motion.div 
              variants={fadeInUp}
              className="mx-auto max-w-3xl text-center"
            >
              <h2 className="mb-6 text-3xl font-bold sm:text-5xl">
                Ready to Scale Your Agency?
              </h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Join hundreds of agencies already using SMMAHUB to streamline their workflows 
                and deliver exceptional results to clients.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" className="text-base px-8">
                    Start Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-base px-8"
                  onClick={() => setShowVideoDialog(true)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Watch Demo
                </Button>
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
            <p className="text-sm text-muted-foreground">
              © 2024 SMMAHUB. All rights reserved.
            </p>
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
              <p className="text-sm text-muted-foreground mt-2">
                Replace with actual video embed
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
