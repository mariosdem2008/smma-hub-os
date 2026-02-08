import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Calculator, Clock, Sparkles, TrendingUp, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marketing } from "@/lib/marketing";
import { track } from "@/lib/analytics";

const CAL_LINK = marketing.calUrl;

interface OdometerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

function Odometer({ value, prefix = "", suffix = "", duration = 1, className = "" }: OdometerProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    const controls = animate(count, value, { duration });
    return controls.stop;
  }, [value, count, duration]);

  return (
    <span className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  prefix?: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step = 1, unit = "", prefix = "", onChange }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-16">
      <div className="flex justify-between items-center">
        <label className="text-body-mobile md:text-body-desktop font-medium text-foreground">{label}</label>
        <span className="text-2xl md:text-3xl font-bold text-gradient-premium">
          {prefix}
          {value.toLocaleString()}
          {unit}
        </span>
      </div>
      <div className="relative">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-brand-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-foreground shadow-lg pointer-events-none"
          style={{ left: `calc(${percentage}% - 10px)` }}
          whileHover={{ scale: 1.1 }}
        >
          <div className="absolute inset-1 rounded-full bg-brand-primary" />
        </motion.div>
      </div>
      <div className="flex justify-between text-small-text text-text-muted">
        <span>
          {prefix}
          {min.toLocaleString()}
          {unit}
        </span>
        <span>
          {prefix}
          {max.toLocaleString()}
          {unit}
        </span>
      </div>
    </div>
  );
}

interface ResultCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  description: string;
  color: "primary" | "accent" | "success";
  delay?: number;
}

function ResultCard({
  icon: Icon,
  label,
  value,
  prefix = "$",
  suffix = "",
  description,
  color,
  delay = 0,
}: ResultCardProps) {
  const colorClasses = {
    primary: {
      bg: "bg-brand-primary/10",
      border: "border-brand-primary/20",
      icon: "text-brand-primary bg-brand-primary/20",
      value: "text-brand-primary",
    },
    accent: {
      bg: "bg-accent/10",
      border: "border-accent/20",
      icon: "text-accent bg-accent/20",
      value: "text-accent",
    },
    success: {
      bg: "bg-success/10",
      border: "border-success/20",
      icon: "text-success bg-success/20",
      value: "text-success",
    },
  } as const;

  const classes = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`${classes.bg} ${classes.border} border rounded-md p-24`}
    >
      <div className="flex items-center gap-12 mb-12">
        <div className={`w-10 h-10 rounded-lg ${classes.icon} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-small-text font-medium text-text-secondary uppercase tracking-small-text">{label}</span>
      </div>
      <Odometer value={value} prefix={prefix} suffix={suffix} duration={1.2} className={`text-3xl md:text-4xl font-bold ${classes.value}`} />
      <p className="mt-8 text-small-text text-text-muted leading-small-text">{description}</p>
    </motion.div>
  );
}

interface ROICalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ROICalculatorModal({ isOpen, onClose }: ROICalculatorModalProps) {
  const [numClients, setNumClients] = useState(10);
  const [hoursSavedPerClient, setHoursSavedPerClient] = useState(6);
  const [loadedHourlyCost, setLoadedHourlyCost] = useState(90);
  const [hiringAvoidedMonthly, setHiringAvoidedMonthly] = useState(0);
  const [additionalClients, setAdditionalClients] = useState(0);
  const [mrrPerClient, setMrrPerClient] = useState(2000);

  const calculations = useMemo(() => {
    const timeReclaimed = numClients * hoursSavedPerClient * loadedHourlyCost;
    const revenueUnlocked = additionalClients * mrrPerClient;
    const totalMonthlyROI = timeReclaimed + hiringAvoidedMonthly + revenueUnlocked;
    const annualROI = totalMonthlyROI * 12;

    return { timeReclaimed, revenueUnlocked, totalMonthlyROI, annualROI };
  }, [additionalClients, hiringAvoidedMonthly, hoursSavedPerClient, loadedHourlyCost, mrrPerClient, numClients]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          >
            <div className="glass-card gradient-border-animated rounded-md relative">
              <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-md">
                <div className="absolute top-0 left-1/4 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
              </div>

              <div className="relative z-10 p-24 md:p-48">
                <button
                  onClick={onClose}
                  className="absolute top-16 right-16 md:top-24 md:right-24 w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors focus-ring"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>

                <div className="text-center mb-48">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="inline-flex items-center gap-2 badge-gradient-border mb-16"
                  >
                    <Calculator className="w-4 h-4 text-brand-primary icon-glow" />
                    <span className="text-small-text font-medium tracking-small-text text-brand-primary">ROI calculator</span>
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="text-2xl md:text-section-headline-desktop font-semibold leading-section-headline tracking-section-headline"
                  >
                    Estimate your
                    <br className="hidden md:block" />
                    <span className="text-gradient-premium">monthly impact</span>
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="mt-16 text-body-mobile md:text-body-desktop text-text-secondary leading-body"
                  >
                    Adjust assumptions to model a conservative estimate for your agency.
                  </motion.p>
                </div>

                <div className="grid gap-48 lg:grid-cols-2">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="space-y-32"
                  >
                    <Slider label="Number of clients" value={numClients} min={1} max={80} onChange={setNumClients} />
                    <Slider
                      label="Hours saved per client / month"
                      value={hoursSavedPerClient}
                      min={0}
                      max={20}
                      unit="h"
                      onChange={setHoursSavedPerClient}
                    />
                    <Slider
                      label="Loaded hourly cost"
                      value={loadedHourlyCost}
                      min={40}
                      max={250}
                      step={5}
                      prefix="$"
                      onChange={setLoadedHourlyCost}
                    />
                    <Slider
                      label="Hiring avoided (monthly)"
                      value={hiringAvoidedMonthly}
                      min={0}
                      max={20000}
                      step={250}
                      prefix="$"
                      onChange={setHiringAvoidedMonthly}
                    />
                    <Slider
                      label="Additional clients you can take on"
                      value={additionalClients}
                      min={0}
                      max={40}
                      onChange={setAdditionalClients}
                    />
                    <Slider
                      label="MRR per client"
                      value={mrrPerClient}
                      min={0}
                      max={20000}
                      step={250}
                      prefix="$"
                      onChange={setMrrPerClient}
                    />
                  </motion.div>

                  <div className="space-y-24">
                    <ResultCard
                      icon={Clock}
                      label="Time reclaimed"
                      value={calculations.timeReclaimed}
                      suffix="/mo"
                      description={`${numClients} clients x ${hoursSavedPerClient}h x $${loadedHourlyCost}/hr`}
                      color="primary"
                      delay={0.4}
                    />
                    <ResultCard
                      icon={UserMinus}
                      label="Hiring avoided"
                      value={hiringAvoidedMonthly}
                      suffix="/mo"
                      description="Optional - set this to 0 if you prefer"
                      color="accent"
                      delay={0.5}
                    />
                    <ResultCard
                      icon={TrendingUp}
                      label="Revenue unlocked"
                      value={calculations.revenueUnlocked}
                      suffix="/mo"
                      description={`${additionalClients} additional clients x $${mrrPerClient.toLocaleString()} MRR`}
                      color="success"
                      delay={0.6}
                    />
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.7 }}
                  className="mt-48 pt-32 border-t border-white/10"
                >
                  <div className="glass-card rounded-md p-32 text-center">
                    <div className="flex items-center justify-center gap-8 mb-16">
                      <Sparkles className="w-5 h-5 text-brand-primary icon-glow" />
                      <span className="text-body-desktop font-semibold text-foreground">Total monthly estimate</span>
                    </div>
                    <Odometer
                      value={calculations.totalMonthlyROI}
                      prefix="$"
                      suffix="/month"
                      duration={1.5}
                      className="text-4xl md:text-5xl font-bold text-gradient-premium"
                    />
                    <p className="mt-12 text-body-mobile text-text-secondary">
                      Annualized estimate: <span className="text-success font-semibold">${calculations.annualROI.toLocaleString()}/year</span>
                    </p>
                  </div>

                  <div className="mt-32 flex flex-col sm:flex-row gap-16 justify-center">
                    <Button asChild size="lg" className="btn-glow btn-shimmer btn-press btn-primary-enhanced tracking-cta-text">
                      <a
                        href={CAL_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-8"
                        onClick={() => track("cta_book_strategy_audit_click", { location: "roi_calculator_modal" })}
                      >
                        Book strategy audit
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button variant="outline" size="lg" onClick={onClose} className="btn-secondary-enhanced tracking-cta-text">
                      Close
                    </Button>
                  </div>

                  <p className="mt-24 text-center text-small-text text-text-muted">
                    Estimates only. Validate assumptions during your strategy audit.
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

