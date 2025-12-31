import { motion } from "framer-motion";
import { Brain, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrainSvg } from "./BrainSvg";
import { EnergyParticles } from "./EnergyParticles";
import { BrainModuleNode } from "./BrainModuleNode";
import { BRAIN_MODULE_ORDER, type BrainModule } from "@/lib/ai/brainModules";
import type { BrainDocument } from "@/lib/ai/brainDocuments";

// Module positions around the brain - SYMMETRIC layout
// Quality Bar is exactly at center (50%, 50%), other modules closer together
const MODULE_POSITIONS: Record<BrainModule, { x: number; y: number }> = {
  // Top row (3 modules) - closer to center
  offer_stack: { x: 25, y: 18 },       // Top left
  bootstrap: { x: 50, y: 12 },         // Top center
  rep_policy: { x: 75, y: 18 },        // Top right

  // Middle row (3 modules) - sides and center
  ai_permissions: { x: 12, y: 50 },    // Left side
  quality_bar: { x: 50, y: 50 },       // Center (core) - EXACT CENTER
  sop_strategy: { x: 88, y: 50 },      // Right side

  // Bottom row (3 modules) - closer to center
  faq_objections: { x: 25, y: 82 },    // Bottom left
  tone_voice: { x: 50, y: 88 },        // Bottom center
  sop_scripting: { x: 75, y: 82 },     // Bottom right
};

interface AgencyBrainVisualizationProps {
  effectiveByModule: Partial<Record<BrainModule, BrainDocument | null>>;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function AgencyBrainVisualization({
  effectiveByModule,
  isLoading,
  onRefresh,
}: AgencyBrainVisualizationProps) {
  // Calculate stats
  const totalModules = BRAIN_MODULE_ORDER.length;
  const configuredModules = Object.values(effectiveByModule).filter(Boolean).length;
  const approvedModules = Object.values(effectiveByModule).filter(
    (d) => d?.status === "approved"
  ).length;

  return (
    <div className="relative min-h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <motion.div
        className="relative z-10 text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Brain className="h-10 w-10 text-primary" />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-bold brain-title-gradient">
            Agency Brain
          </h1>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-6 w-6 text-accent" />
          </motion.div>
        </div>
        <p className="text-muted-foreground max-w-md mx-auto">
          The central intelligence powering your AI operations
        </p>

        {/* Stats bar */}
        <motion.div
          className="flex items-center justify-center gap-6 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{approvedModules}</span> Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {configuredModules - approvedModules}
              </span>{" "}
              Pending
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted" />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {totalModules - configuredModules}
              </span>{" "}
              Empty
            </span>
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="ml-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </motion.div>
      </motion.div>

      {/* Brain visualization container */}
      <div className="flex-1 relative">
        {/* Energy particles background */}
        <EnergyParticles count={15} />

        {/* Centered module cluster (Quality Bar sits at exact center) */}
        <div className="absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 w-full max-w-[650px] -translate-x-1/2 -translate-y-1/2"
            style={{ height: "500px" }}
          >
            {/* Brain SVG - centered at 50% 50% to match Quality Bar position */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[70%] max-w-[380px] aspect-square">
                <BrainSvg />
              </div>
            </div>

            {/* Module nodes positioned around the brain */}
            <div className="absolute inset-0">
              {BRAIN_MODULE_ORDER.map((module, index) => (
                <BrainModuleNode
                  key={module}
                  module={module}
                  document={effectiveByModule[module] ?? null}
                  position={MODULE_POSITIONS[module]}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <motion.div
        className="relative z-10 text-center mt-8 pb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-sm text-muted-foreground">
          <span className="text-primary">Hover</span> on a module to see details,{" "}
          <span className="text-primary">click</span> to configure
        </p>
      </motion.div>
    </div>
  );
}
