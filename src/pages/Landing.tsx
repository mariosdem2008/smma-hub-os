import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function Landing() {
  const [showVideoDialog, setShowVideoDialog] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <LayoutGrid className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-primary">SMMAHUB</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* SECTION 1 - HERO */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center animate-fade-in">
            <Badge variant="secondary" className="mb-6 text-sm">
              <Zap className="mr-2 h-3 w-3" />
              The Operating System for Modern Agencies
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              The Operating System for{" "}
              <span className="text-primary">Modern Social Media Agencies</span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
              Run your entire agency — clients, content, branding, assets, inspiration, 
              calendar, and team — all in one powerful workspace.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="text-base px-8">
                  Get Started Free
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

            {/* Hero Mockup */}
            <div className="mt-16 rounded-xl border bg-card p-2 shadow-2xl animate-fade-in">
              <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                <div className="text-center">
                  <LayoutGrid className="mx-auto h-16 w-16 text-primary mb-4" />
                  <p className="text-muted-foreground">Dashboard Preview</p>
                </div>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
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
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 - PROOF BAR */}
      <section className="border-y bg-muted/30 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Trusted by agencies managing 10–100+ client brands
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8">
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
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 - CORE BENEFITS */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Everything You Need to Scale
            </h2>
            <p className="text-lg text-muted-foreground">
              Purpose-built for social media marketing agencies
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <LayoutGrid className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Everything Organized</CardTitle>
                <CardDescription className="text-base">
                  Centralize clients, branding, assets, tasks, and social profiles in one place.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Lightning-Fast Content Systems</CardTitle>
                <CardDescription className="text-base">
                  Ideas, pillars, calendar, saved captions — all connected and ready to use.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Team & Clients in One Workspace</CardTitle>
                <CardDescription className="text-base">
                  Invite your team, assign roles, collaborate in real time with full control.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION 4 - FEATURE SHOWCASE */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="space-y-32">
            {/* Feature 1 - Client Command Center */}
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="order-2 lg:order-1">
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
              </div>
              <div className="order-1 lg:order-2">
                <Card className="p-4 shadow-xl">
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <Palette className="mx-auto h-12 w-12 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Client Dashboard</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Feature 2 - Content Calendar */}
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div>
                <Card className="p-4 shadow-xl">
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <Calendar className="mx-auto h-12 w-12 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Content Calendar</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div>
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
              </div>
            </div>

            {/* Feature 3 - Asset Management */}
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="order-2 lg:order-1">
                <Badge className="mb-4">Asset Library</Badge>
                <h3 className="mb-4 text-3xl font-bold">
                  Smart Asset Management
                </h3>
                <p className="mb-6 text-lg text-muted-foreground">
                  Upload, organize, and access all your client assets in one place. 
                  Images, videos, documents — everything is searchable and ready to use.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <span>Auto-preview for all file types</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <span>Smart filtering and search</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <span>Organized per client</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <Card className="p-4 shadow-xl">
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <FolderOpen className="mx-auto h-12 w-12 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Asset Library</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Feature 4 - Team Collaboration */}
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div>
                <Card className="p-4 shadow-xl">
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <Users className="mx-auto h-12 w-12 text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">Team Workspace</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div>
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
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 - VIDEO DEMO */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              See SMMAHUB in Action
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Watch how agencies use SMMAHUB to scale their operations (60 seconds)
            </p>
            <Card 
              className="cursor-pointer overflow-hidden hover:shadow-xl transition-all group"
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
          </div>
        </div>
      </section>

      {/* SECTION 6 - PRICING */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free, scale as you grow
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3 mx-auto max-w-6xl">
            {/* Starter */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Starter</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <CardDescription className="mt-2">
                  Perfect for freelancers and small teams
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 mb-6 flex-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Up to 10 clients</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">3 team members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">10GB storage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Basic support</span>
                  </li>
                </ul>
                <Link to="/auth" className="w-full">
                  <Button variant="outline" className="w-full">
                    Get Started Free
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro - Featured */}
            <Card className="flex flex-col border-primary border-2 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary">Most Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$99</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <CardDescription className="mt-2">
                  For growing agencies
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 mb-6 flex-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Up to 30 clients</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">10 team members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">50GB storage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Priority support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Advanced analytics</span>
                  </li>
                </ul>
                <Link to="/auth" className="w-full">
                  <Button className="w-full">
                    Get Started Free
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Agency+ */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Agency+</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$199</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <CardDescription className="mt-2">
                  For established agencies
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 mb-6 flex-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Unlimited clients</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Unlimited team members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">200GB storage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">White-label options</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Dedicated support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Custom integrations</span>
                  </li>
                </ul>
                <Link to="/auth" className="w-full">
                  <Button variant="outline" className="w-full">
                    Get Started Free
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION 7 - FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to know
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Is SMMAHUB replacing Notion or ClickUp?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  SMMAHUB is purpose-built for social media agencies, with features like 
                  client branding, content calendars, and asset management that generic tools 
                  don't offer out of the box. It's designed to replace multiple tools.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Can I invite my team members?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Yes! You can invite team members with role-based permissions (Owner, Manager, 
                  Creator, Viewer) to control exactly what each person can access and edit.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How many clients can I manage?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  It depends on your plan: Starter (10 clients), Pro (30 clients), Agency+ 
                  (unlimited clients). You can upgrade anytime as your agency grows.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Do you support AI features?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  AI-powered features are on our roadmap, including caption generation, 
                  content suggestions, and smart asset tagging. Stay tuned!
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Is there a free trial?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Yes! All plans come with a 14-day free trial. No credit card required to start.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  Can I import data from other tools?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Yes, we support CSV imports for clients, contacts, and content. Our team 
                  can also help with custom migrations from other platforms.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  What platforms do you support?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  SMMAHUB works with Instagram, Facebook, TikTok, LinkedIn, YouTube, and more. 
                  We're constantly adding support for new platforms.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="border rounded-lg px-6">
                <AccordionTrigger className="text-left">
                  How secure is my data?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  We use bank-level encryption, secure cloud storage, and regular backups. 
                  Your data is always protected and only accessible by your team.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* SECTION 8 - FINAL CTA */}
      <section className="py-20 bg-primary/5 border-t">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-4xl font-bold sm:text-5xl">
              Ready to Scale Your Agency?
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Join hundreds of agencies already using SMMAHUB to streamline operations and grow faster.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="text-base px-8">
                  Start Free Trial
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
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-surface">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <LayoutGrid className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-primary">SMMAHUB</span>
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
            <DialogTitle>SMMAHUB Demo</DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Play className="mx-auto h-16 w-16 text-primary mb-4" />
              <p className="text-muted-foreground">Video player placeholder</p>
              <p className="text-sm text-muted-foreground mt-2">
                Replace with Loom embed or MP4 video
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
