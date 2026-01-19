import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";

interface ComparisonItem {
  before: string;
  after: string;
}

interface BeforeAfterToggleProps {
  items: ComparisonItem[];
}

export function BeforeAfterToggle({ items }: BeforeAfterToggleProps) {
  const [showAfter, setShowAfter] = useState(false);

  return (
    <div className="w-full">
      {/* Toggle Switch */}
      <div className="flex justify-center mb-[8px]">
        <div className="relative inline-flex items-center p-1 rounded-full bg-card border border-border">
          <button
            onClick={() => setShowAfter(false)}
            className={`relative z-10 px-6 py-2.5 text-sm font-medium rounded-full transition-colors duration-200 ${
              !showAfter ? "text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Without SMMAHUB
          </button>
          <button
            onClick={() => setShowAfter(true)}
            className={`relative z-10 px-6 py-2.5 text-sm font-medium rounded-full transition-colors duration-200 ${
              showAfter ? "text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            With SMMAHUB
          </button>
          <motion.div
            className="absolute top-1 bottom-1 rounded-full bg-primary"
            initial={false}
            animate={{
              x: showAfter ? "100%" : "0%",
              width: showAfter ? "calc(50% - 4px)" : "calc(50% - 4px)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ left: 4 }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait">
          {!showAfter ? (
            <motion.div
              key="before"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="grid gap-[4px] sm:grid-cols-2"
            >
              {items.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-3 p-[4px] rounded-xl bg-destructive/5 border border-destructive/20"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </div>
                  <p className="text-sm text-muted-foreground">{item.before}</p>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="after"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="grid gap-[4px] sm:grid-cols-2"
            >
              {items.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-3 p-[4px] rounded-xl bg-success/5 border border-success/20"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-success" />
                  </div>
                  <p className="text-sm text-foreground">{item.after}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
