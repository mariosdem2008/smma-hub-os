import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { type BrainModule, BRAIN_MODULE_LABELS } from "@/lib/ai/brainModules";
import type { BrainDocument } from "@/lib/ai/brainDocuments";
import { hapticSelection } from "@/lib/haptics";

// Module icons mapping
const MODULE_ICONS: Record<BrainModule, string> = {
  bootstrap: "rocket",
  rep_policy: "shield",
  sop_strategy: "target",
  sop_scripting: "pen-tool",
  tone_voice: "mic",
  faq_objections: "help-circle",
  ai_permissions: "lock",
  offer_stack: "layers",
  quality_bar: "award",
};

// Module descriptions
const MODULE_DESCRIPTIONS: Record<BrainModule, string> = {
  bootstrap: "Foundation profile with agency identity and offerings",
  rep_policy: "AI representative behavior rules and boundaries",
  sop_strategy: "Content strategy pillars and planning process",
  sop_scripting: "Hook templates, CTAs, and format guidelines",
  tone_voice: "Brand voice, vocabulary, and writing rules",
  faq_objections: "Common questions and objection handling",
  ai_permissions: "AI read/write permissions and safety rules",
  offer_stack: "Service tiers, pricing, and positioning",
  quality_bar: "Review criteria and approval thresholds",
};

// URL param mapping for navigation
const MODULE_URL_PARAMS: Record<BrainModule, string> = {
  bootstrap: "bootstrap_profile",
  rep_policy: "rep_policy",
  sop_strategy: "strategy_sop",
  sop_scripting: "scripting_sop",
  tone_voice: "tone_voice",
  faq_objections: "faq_objections",
  ai_permissions: "ai_permissions",
  offer_stack: "offer_stack",
  quality_bar: "quality_bar",
};

interface BrainModuleNodeProps {
  module: BrainModule;
  document: BrainDocument | null;
  position: { x: number; y: number };
  index: number;
}

export function BrainModuleNode({
  module,
  document,
  position,
  index,
}: BrainModuleNodeProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const isConfigured = !!document;
  const isApproved = document?.status === "approved";
  const label = BRAIN_MODULE_LABELS[module];
  const description = MODULE_DESCRIPTIONS[module];

  const handleClick = () => {
    hapticSelection();
    navigate(`/agency/brain/${MODULE_URL_PARAMS[module]}`);
  };

  // Determine node color based on status
  const getNodeColors = () => {
    if (isApproved) {
      return {
        bg: "from-green-500/20 to-primary/20",
        border: "border-green-500/50",
        glow: "0 0 20px hsl(142 71% 52% / 0.4)",
        text: "text-green-400",
      };
    }
    if (isConfigured) {
      return {
        bg: "from-yellow-500/20 to-primary/20",
        border: "border-yellow-500/50",
        glow: "0 0 15px hsl(38 92% 50% / 0.3)",
        text: "text-yellow-400",
      };
    }
    return {
      bg: "from-muted/30 to-muted/10",
      border: "border-muted/30",
      glow: "0 0 10px hsl(var(--muted) / 0.2)",
      text: "text-muted-foreground",
    };
  };

  const colors = getNodeColors();

  return (
    <motion.div
      className="absolute brain-node"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)",
        animationDelay: `${index * 0.3}s`,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: index * 0.1,
      }}
    >
      {/* Node container */}
      <motion.button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative flex flex-col items-center justify-center
          w-20 h-20 md:w-24 md:h-24
          rounded-2xl cursor-pointer
          bg-gradient-to-br ${colors.bg}
          border ${colors.border}
          backdrop-blur-sm
          transition-colors duration-300
        `}
        style={{
          boxShadow: colors.glow,
        }}
        whileHover={{
          scale: 1.15,
          boxShadow: isApproved
            ? "0 0 30px hsl(142 71% 52% / 0.6)"
            : isConfigured
            ? "0 0 25px hsl(38 92% 50% / 0.5)"
            : "0 0 20px hsl(var(--primary) / 0.4)",
        }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Status indicator */}
        <motion.div
          className="absolute -top-1 -right-1"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.1 + 0.3 }}
        >
          {isApproved ? (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          ) : isConfigured ? (
            <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
              <AlertCircle className="w-3 h-3 text-white" />
            </div>
          ) : null}
        </motion.div>

        {/* Module icon placeholder - using first letter */}
        <div className={`text-2xl md:text-3xl font-bold ${colors.text}`}>
          {label.charAt(0)}
        </div>

        {/* Module name */}
        <span className={`text-[10px] md:text-xs font-medium mt-1 text-center px-1 ${colors.text}`}>
          {label.split(" ").slice(0, 2).join(" ")}
        </span>

        {/* Pulse ring for unconfigured modules */}
        {!isConfigured && (
          <motion.div
            className="absolute inset-0 rounded-2xl border border-primary/30"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </motion.button>

      {/* Expanded info panel on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="absolute z-50 w-64"
            style={{
              // Position the panel based on node location
              left: position.x > 50 ? "auto" : "100%",
              right: position.x > 50 ? "100%" : "auto",
              top: "50%",
              marginLeft: position.x > 50 ? 0 : "0.5rem",
              marginRight: position.x > 50 ? "0.5rem" : 0,
            }}
            initial={{ opacity: 0, scale: 0.8, x: position.x > 50 ? 10 : -10, y: "-50%" }}
            animate={{ opacity: 1, scale: 1, x: 0, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.8, x: position.x > 50 ? 10 : -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="bg-card/95 backdrop-blur-md rounded-xl border border-border p-4 shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-sm">{label}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {description}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isApproved
                      ? "bg-green-500/20 text-green-400"
                      : isConfigured
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {isApproved ? "Active" : isConfigured ? "Pending" : "Not configured"}
                </span>
                <span className="text-xs text-primary flex items-center gap-1">
                  Configure <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
