import { motion } from "framer-motion";
import { Sparkles, Orbit, WandSparkles, Workflow, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const capabilityItems = [
  {
    title: "Strategy Autopilot",
    description: "Builds weekly plans from your offers, market, and priorities.",
    icon: Orbit,
    accent: "from-[#5b5fff]/70 to-[#22d3ee]/70",
  },
  {
    title: "Creative Engine",
    description: "Generates campaign-ready angles, scripts, and hooks in your brand voice.",
    icon: WandSparkles,
    accent: "from-[#9b8cff]/70 to-[#5b5fff]/70",
  },
  {
    title: "Ops Intelligence",
    description: "Turns briefs and client context into structured execution steps.",
    icon: Workflow,
    accent: "from-[#22d3ee]/70 to-[#5b5fff]/70",
  },
];

export default function AgencyWelcomeAI() {
  const navigate = useNavigate();

  return (
    <div className="onboarding-topo relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5b5fff]/18 blur-3xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#5b5fff]/35"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/25"
          animate={{ rotate: -360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#5b5fff]/20 blur-3xl" />
        <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#7a6dff]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-full border border-white/20 bg-black/45 px-4 py-2 text-xs uppercase tracking-[0.25em] text-cyan-200 backdrop-blur-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            AI Cofounder Activated
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.55 }}
          className="mt-6 max-w-4xl text-center text-4xl font-semibold leading-tight md:text-6xl"
        >
          Your agency brain is live.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.55 }}
          className="mt-5 max-w-3xl text-center text-base text-white/70 md:text-lg"
        >
          Your AI system can now plan, create, and execute with your agency context built in.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.55 }}
          className="mt-7 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/75 backdrop-blur-sm"
        >
          <Radar className="h-4 w-4 text-cyan-300" />
          Calibration complete. Systems online.
        </motion.div>

        <div className="mt-10 grid w-full max-w-5xl gap-4 md:grid-cols-3">
          {capabilityItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + index * 0.1, duration: 0.45 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/45 p-5 backdrop-blur-sm"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.accent}`} />
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#5b5fff]/20">
                <item.icon className="h-5 w-5 text-cyan-200" />
              </div>
              <h2 className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/90">{item.title}</h2>
              <p className="mt-3 text-sm text-white/70">{item.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-12"
        >
          <Button
            size="lg"
            className="h-12 rounded-xl bg-[#5b5fff] px-8 text-base font-semibold text-white shadow-[0_0_30px_rgba(91,95,255,0.45)] hover:bg-[#7275ff]"
            onClick={() => navigate("/dashboard", { replace: true })}
          >
            Enter Agency Dashboard
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
