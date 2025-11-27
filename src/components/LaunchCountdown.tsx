import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";

export function LaunchCountdown() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const launchDate = new Date("2025-12-23T00:00:00");
      const now = new Date();
      const difference = launchDate.getTime() - now.getTime();

      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }

      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeBlocks = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Min" },
    { value: timeLeft.seconds, label: "Sec" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="inline-flex flex-col items-center gap-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-6 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Calendar className="h-4 w-4" />
        <span>Launching December 23rd, 2025</span>
      </div>
      
      <div className="flex gap-3 sm:gap-4">
        {timeBlocks.map((block, index) => (
          <div key={block.label} className="flex flex-col items-center">
            <motion.div
              key={block.value}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-lg bg-background/80 shadow-lg"
            >
              <span className="text-2xl sm:text-3xl font-bold tabular-nums">
                {String(block.value).padStart(2, "0")}
              </span>
            </motion.div>
            <span className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {block.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
