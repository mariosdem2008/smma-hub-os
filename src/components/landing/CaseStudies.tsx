import { motion } from "framer-motion";
import { StaggerContainer, StaggerItem, AnimatedSection } from "./AnimatedSection";
import { Badge } from "@/components/ui/badge";

const CASE_STUDIES = [
  {
    agencyName: "Growth Gurus",
    logo: "/placeholder.svg", // Using public/placeholder.svg
    challenge: "Struggled to scale past 5 clients without quality dropping and hiring expensive staff.",
    solution: "Implemented SMMAHUB to automate their core SOPs and client onboarding processes.",
    results: [
      { value: "+150%", label: "Client Capacity" },
      { value: "$60,000/yr", label: "Avoided Hiring Costs" },
      { value: "95%", label: "Time Saved on Reporting" },
    ],
    testimonial: "SMMAHUB didn't just save us time, it fundamentally changed how we scale. We're more profitable and our clients are happier.",
    testimonialAuthor: "John Doe, CEO of Growth Gurus",
  },
  {
    agencyName: "Social Wave",
    logo: "/placeholder.svg",
    challenge: "Inconsistent output quality across different account managers and high churn of client knowledge.",
    solution: "Used the 'Client Brain' to create a permanent, reusable knowledge base for each client.",
    results: [
      { value: "100%", label: "SOP Consistency" },
      { value: "+30%", label: "Client Retention" },
      { value: "2x", label: "Faster Jr. Staff Onboarding" },
    ],
    testimonial: "The 'Client Brain' is our competitive advantage. Nothing gets lost, and quality is guaranteed, no matter who is doing the work.",
    testimonialAuthor: "Jane Smith, Founder of Social Wave",
  },
];

export function CaseStudiesSection() {
  return (
    <section id="results" className="py-[20px] border-y border-border/50 bg-surface/30">
      <div className="container mx-auto px-[4px]">
        <AnimatedSection className="mx-auto max-w-6xl">
          <div className="text-center mb-[12px]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary mb-3">
              The ROI of an AI Employee
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Proven Results from Agencies Like Yours
            </h2>
            <p className="mt-[4px] text-muted-foreground max-w-2xl mx-auto">
              We're not just a tool, we're a growth partner. See the tangible impact on profitability and scale.
            </p>
          </div>

          <StaggerContainer className="space-y-[12px]">
            {CASE_STUDIES.map((study, index) => (
              <StaggerItem key={index}>
                <div className="grid gap-[8px] md:grid-cols-12 md:items-center">
                  <div className="md:col-span-5 lg:col-span-4">
                    <div className="p-6 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-[4px] mb-[4px]">
                            <img src={study.logo} alt={`${study.agencyName} logo`} className="h-12 w-12 rounded-full bg-muted" />
                            <div>
                                <h3 className="text-xl font-semibold">{study.agencyName}</h3>
                                <p className="text-sm text-muted-foreground">Case Study</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-[4px]"><strong>Challenge:</strong> {study.challenge}</p>
                        <p className="text-sm text-muted-foreground"><strong>Solution:</strong> {study.solution}</p>
                    </div>
                  </div>
                  <div className="md:col-span-7 lg:col-span-8">
                    <div className="p-6 rounded-lg bg-card border border-border">
                      <div className="mb-5">
                         <p className="text-lg font-medium text-foreground italic">"{study.testimonial}"</p>
                         <p className="text-sm text-right mt-2 text-muted-foreground">- {study.testimonialAuthor}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-[4px] text-center border-t border-border/50 pt-5">
                        {study.results.map((result) => (
                          <div key={result.label}>
                            <p className="text-3xl font-semibold text-primary">{result.value}</p>
                            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{result.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </AnimatedSection>
      </div>
    </section>
  );
}
