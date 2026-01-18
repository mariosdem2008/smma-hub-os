import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, Clock, DollarSign, Mail, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CAL_LINK = "https://cal.com/SMMAHUB/fit";

// Price points for ROI calculation (real high-ticket pricing)
const PLAN_PRICES = {
  starter: 399,
  growth: 799,
  scale_pro: 1299,
};

function ROIReportForm({ calculations }: { calculations: any }) {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you would send the email and calculations to a backend service.
    // Here, we just simulate the success state.
    if (email) {
      console.log(`Submitting report for ${email}`, calculations);
      setIsSubmitted(true);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        className="p-4 rounded-lg bg-success/10 border border-success/20 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="font-semibold text-success">Thank you!</p>
        <p className="text-sm text-success/80">Your personalized ROI report has been sent to {email}.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
        className="p-4 rounded-lg bg-card border border-primary/20"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
    >
        <p className="text-sm font-semibold text-foreground text-center mb-3">Get Your Personalized ROI Report</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-grow">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-10"
            />
        </div>
        <Button type="submit" className="w-full sm:w-auto btn-shimmer">
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
      </form>
    </motion.div>
  );
}


export function ROICalculator() {
  const [clients, setClients] = useState(10);
  const [hoursPerClient, setHoursPerClient] = useState(20);
  const [hourlyRate, setHourlyRate] = useState(50);

  const calculations = useMemo(() => {
    const monthlyCost = clients * hoursPerClient * hourlyRate;
    const savingsPercent = 0.5; // 50% time savings claim
    const monthlySavings = monthlyCost * savingsPercent;
    const annualSavings = monthlySavings * 12;

    // Calculate payback period based on Growth plan
    const planCost = PLAN_PRICES.growth;
    const paybackDays = Math.ceil((planCost / monthlySavings) * 30);

    return {
      monthlyCost,
      monthlySavings,
      annualSavings,
      paybackDays: Math.min(paybackDays, 30), // Cap at 30 days for display
    };
  }, [clients, hoursPerClient, hourlyRate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="w-full">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Inputs */}
        <div className="space-y-8">
          {/* Clients Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-foreground">
                Current number of clients
              </label>
              <span className="text-2xl font-bold text-primary">{clients}</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={clients}
              onChange={(e) => setClients(Number(e.target.value))}
              className="w-full h-2 bg-card rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-glow-sm"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>50</span>
            </div>
          </div>

          {/* Hours Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-foreground">
                Hours per client per month
              </label>
              <span className="text-2xl font-bold text-primary">{hoursPerClient}h</span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              value={hoursPerClient}
              onChange={(e) => setHoursPerClient(Number(e.target.value))}
              className="w-full h-2 bg-card rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-glow-sm"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5h</span>
              <span>40h</span>
            </div>
          </div>

          {/* Rate Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-foreground">
                Your team's hourly cost
              </label>
              <span className="text-2xl font-bold text-primary">${hourlyRate}</span>
            </div>
            <input
              type="range"
              min="25"
              max="150"
              step="5"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="w-full h-2 bg-card rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-glow-sm"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>$25</span>
              <span>$150</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div
              className="p-5 rounded-lg bg-card border border-border"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={calculations.monthlyCost}
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Monthly Time Cost
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(calculations.monthlyCost)}
              </p>
            </motion.div>

            <motion.div
              className="p-5 rounded-lg bg-success/10 border border-success/20"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              key={calculations.monthlySavings}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-xs font-medium text-success uppercase tracking-wider">
                  Monthly Savings
                </span>
              </div>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(calculations.monthlySavings)}
              </p>
            </motion.div>
          </div>

          <motion.div
            className="p-6 rounded-lg bg-card border border-border"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={calculations.annualSavings}
          >
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-primary uppercase tracking-wider">
                Annual Impact
              </span>
            </div>
            <p className="text-4xl font-bold text-foreground mb-2">
              {formatCurrency(calculations.annualSavings)}
            </p>
            <p className="text-sm text-muted-foreground">
              in recovered time value per year
            </p>
          </motion.div>

          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Payback Period
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              At $799/month (Growth plan), SMMAHUB pays for itself in{" "}
              <span className="text-primary font-semibold">
                {calculations.paybackDays} days
              </span>
            </p>
          </div>

          <ROIReportForm calculations={calculations} />

        </div>
      </div>
    </div>
  );
}
