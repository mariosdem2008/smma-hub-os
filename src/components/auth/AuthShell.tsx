import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Layers3, LockKeyhole, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  mode?: "agency" | "client";
};

export function AuthShell({ eyebrow, title, description, children, mode = "agency" }: AuthShellProps) {
  const proof =
    mode === "client"
      ? ["Private client portal", "Agency-approved access", "Secure collaboration"]
      : ["Governed AI workspace", "Approval-first workflows", "Agency operating system"];

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-stretch">
          <section className="flex flex-col justify-center">
            <Link to="/" className="mb-8 inline-flex w-fit items-center gap-3 rounded-md focus-ring">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers3 className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold">SMMAHUB</span>
            </Link>

            <Card className="w-full max-w-md p-5 sm:p-6">
              <div className="mb-6">
                <div className="page-eyebrow">{eyebrow}</div>
                <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-foreground">{title}</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
              {children}
            </Card>
          </section>

          <aside className="hidden overflow-hidden rounded-2xl border border-border/80 bg-card shadow-panel lg:block">
            <div className="flex h-full flex-col justify-between p-8">
              <div>
                <div className="inline-flex rounded-lg border border-primary/20 bg-primary/10 p-3 text-primary">
                  {mode === "client" ? <LockKeyhole className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                </div>
                <h2 className="mt-8 max-w-lg font-display text-4xl font-bold leading-tight">
                  {mode === "client" ? "A calm place for client approvals." : "A premium control room for agency AI."}
                </h2>
                <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
                  {mode === "client"
                    ? "Clients see only what matters: assets, approvals, messages, and delivery updates in a polished portal."
                    : "Your team gets the context, approvals, and guardrails needed to move faster without losing founder control."}
                </p>
              </div>

              <div className="mt-12 grid gap-3">
                {proof.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 p-3">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
