import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Brain,
  Target,
  FileText,
  CheckCircle2,
  Play,
  Pause
} from "lucide-react";
import { Button } from "@/components/ui/button";

const WORKFLOW_STEPS = [
  {
    id: "onboard",
    title: "Onboard",
    icon: UserPlus,
    description: "Capture goals, brand voice, offers, constraints, and approvals in one guided flow.",
    detail: "Client Brain is populated automatically.",
  },
  {
    id: "brain",
    title: "Brain",
    icon: Brain,
    description: "Everything about the client in one place—accessible to AI and team.",
    detail: "AI references this for every task.",
  },
  {
    id: "strategy",
    title: "Strategy",
    icon: Target,
    description: "Generate themes, angles, and monthly plans based on approved context.",
    detail: "No guessing. Only approved information used.",
  },
  {
    id: "content",
    title: "Content",
    icon: FileText,
    description: "Draft captions, scripts, and visuals aligned with brand voice.",
    detail: "Starting point, not final—your team reviews.",
  },
  {
    id: "approvals",
    title: "Approvals",
    icon: CheckCircle2,
    description: "Client reviews and approves via portal. Feedback loops back to Brain.",
    detail: "Continuous learning, better outputs over time.",
  },
];

const AUTO_PLAY_INTERVAL = 4000; // 4 seconds per step

export function WorkflowStepper() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setActiveStep((prev) => (prev + 1) % WORKFLOW_STEPS.length);
      }, AUTO_PLAY_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying]);

  const handleStepClick = (index: number) => {
    setActiveStep(index);
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const currentStep = WORKFLOW_STEPS[activeStep];

  return (
    <div className="w-full">
      {/* Step Navigation */}
      <div className="relative mb-[8px]">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-border hidden sm:block" />
        <motion.div
          className="absolute top-5 left-0 h-[2px] bg-gradient-to-r from-primary to-accent hidden sm:block"
          initial={{ width: "0%" }}
          animate={{ width: `${(activeStep / (WORKFLOW_STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Step Buttons */}
        <div className="relative flex justify-between items-start">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === activeStep;
            const isPast = index < activeStep;

            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(index)}
                className="flex flex-col items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
              >
                <motion.div
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-glow-sm"
                      : isPast
                      ? "bg-primary/20 text-primary"
                      : "bg-card border border-border text-muted-foreground group-hover:border-primary/50"
                  }`}
                  animate={isActive ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon className="w-5 h-5" />
                </motion.div>
                <span
                  className={`text-xs font-medium transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="relative bg-card/50 border border-border rounded-2xl p-6 sm:p-[8px] min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-[4px]"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <currentStep.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {activeStep + 1} of {WORKFLOW_STEPS.length}
                </p>
                <h3 className="text-xl font-semibold text-foreground">
                  {currentStep.title}
                </h3>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {currentStep.description}
            </p>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-primary">→</span>
              <span className="text-foreground font-medium">{currentStep.detail}</span>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Play/Pause Control */}
        <div className="absolute bottom-4 right-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePlayPause}
            className="text-muted-foreground hover:text-foreground"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Play
              </>
            )}
          </Button>
        </div>

        {/* Progress Dots (Mobile) */}
        <div className="flex justify-center gap-2 mt-6 sm:hidden">
          {WORKFLOW_STEPS.map((_, index) => (
            <button
              key={index}
              onClick={() => handleStepClick(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === activeStep
                  ? "bg-primary w-6"
                  : "bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
