import { motion } from "framer-motion";

interface BrainSvgProps {
  className?: string;
}

// Neuron positions - arranged in a brain-like neural network pattern
const NEURONS = [
  // Central cluster (core)
  { x: 200, y: 200, size: 8, layer: 0 },

  // Inner ring - 6 neurons
  { x: 200, y: 140, size: 5, layer: 1 },
  { x: 252, y: 170, size: 5, layer: 1 },
  { x: 252, y: 230, size: 5, layer: 1 },
  { x: 200, y: 260, size: 5, layer: 1 },
  { x: 148, y: 230, size: 5, layer: 1 },
  { x: 148, y: 170, size: 5, layer: 1 },

  // Middle ring - 8 neurons
  { x: 200, y: 80, size: 4, layer: 2 },
  { x: 270, y: 110, size: 4, layer: 2 },
  { x: 310, y: 170, size: 4, layer: 2 },
  { x: 310, y: 230, size: 4, layer: 2 },
  { x: 270, y: 290, size: 4, layer: 2 },
  { x: 200, y: 320, size: 4, layer: 2 },
  { x: 130, y: 290, size: 4, layer: 2 },
  { x: 90, y: 230, size: 4, layer: 2 },
  { x: 90, y: 170, size: 4, layer: 2 },
  { x: 130, y: 110, size: 4, layer: 2 },

  // Outer scattered neurons
  { x: 160, y: 50, size: 3, layer: 3 },
  { x: 240, y: 50, size: 3, layer: 3 },
  { x: 320, y: 90, size: 3, layer: 3 },
  { x: 355, y: 150, size: 3, layer: 3 },
  { x: 360, y: 220, size: 3, layer: 3 },
  { x: 340, y: 290, size: 3, layer: 3 },
  { x: 280, y: 340, size: 3, layer: 3 },
  { x: 200, y: 360, size: 3, layer: 3 },
  { x: 120, y: 340, size: 3, layer: 3 },
  { x: 60, y: 290, size: 3, layer: 3 },
  { x: 40, y: 220, size: 3, layer: 3 },
  { x: 45, y: 150, size: 3, layer: 3 },
  { x: 80, y: 90, size: 3, layer: 3 },
];

// Neural connections between neurons
const CONNECTIONS = [
  // Core to inner ring
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
  // Inner ring connections
  [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1],
  // Inner to middle
  [1, 7], [2, 8], [2, 9], [3, 9], [3, 10], [4, 11], [4, 12], [5, 12], [5, 13], [6, 14], [6, 15], [1, 16],
  // Middle ring connections
  [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 7],
  // Middle to outer
  [7, 17], [7, 18], [8, 19], [9, 20], [10, 21], [11, 22], [12, 23], [12, 24], [13, 25], [14, 26], [15, 27], [16, 28], [16, 29],
  // Some cross connections for complexity
  [1, 8], [3, 11], [5, 14], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28],
];

export function BrainSvg({ className = "" }: BrainSvgProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={`w-full h-full ${className}`}
      style={{ maxWidth: "500px", maxHeight: "500px" }}
    >
      <defs>
        {/* Neuron gradient */}
        <radialGradient id="neuronGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="1" />
          <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </radialGradient>

        {/* Core neuron gradient */}
        <radialGradient id="coreNeuronGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="30%" stopColor="hsl(var(--accent))" stopOpacity="1" />
          <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
        </radialGradient>

        {/* Connection gradient */}
        <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
          <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
        </linearGradient>

        {/* Glow filter */}
        <filter id="neuronGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Strong glow for core */}
        <filter id="coreGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Pulse animation gradient */}
        <linearGradient id="pulseGradient">
          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0" />
          <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Neural connections - base layer */}
      <g className="connections-base">
        {CONNECTIONS.map(([from, to], index) => {
          const fromNeuron = NEURONS[from];
          const toNeuron = NEURONS[to];
          return (
            <line
              key={`base-${index}`}
              x1={fromNeuron.x}
              y1={fromNeuron.y}
              x2={toNeuron.x}
              y2={toNeuron.y}
              stroke="hsl(var(--primary))"
              strokeWidth="1"
              strokeOpacity="0.15"
            />
          );
        })}
      </g>

      {/* Animated signal pulses along connections */}
      <g className="signal-pulses">
        {CONNECTIONS.slice(0, 20).map(([from, to], index) => {
          const fromNeuron = NEURONS[from];
          const toNeuron = NEURONS[to];
          return (
            <motion.line
              key={`pulse-${index}`}
              x1={fromNeuron.x}
              y1={fromNeuron.y}
              x2={toNeuron.x}
              y2={toNeuron.y}
              stroke="url(#pulseGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: [0, 1],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: 2,
                delay: index * 0.15,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </g>

       {/* Neurons - outer layer first */}
       {NEURONS.slice().reverse().map((neuron, index) => {
         const realIndex = NEURONS.length - 1 - index;
         const isCore = realIndex === 0;
         const delay = neuron.layer * 0.2 + (realIndex % 6) * 0.05;
         const neuronSize = typeof neuron.size === "number" && Number.isFinite(neuron.size) ? neuron.size : 3;

         return (
           <motion.g key={realIndex}>
             {/* Neuron pulse ring */}
             {neuron.layer <= 1 && (
               <motion.circle
                 cx={neuron.x}
                 cy={neuron.y}
                 r={neuronSize}
                 fill="none"
                 stroke="hsl(var(--accent))"
                 strokeWidth="1"
                 strokeOpacity="0.3"
                 animate={{
                   r: [neuronSize, neuronSize + 8, neuronSize],
                   strokeOpacity: [0.3, 0, 0.3],
                 }}
                 transition={{
                   duration: 3,
                  delay: delay + 1,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            )}

            {/* Neuron body */}
             <motion.circle
               cx={neuron.x}
               cy={neuron.y}
               r={neuronSize}
               fill={isCore ? "url(#coreNeuronGradient)" : "url(#neuronGradient)"}
               filter={isCore ? "url(#coreGlow)" : "url(#neuronGlow)"}
               initial={{ scale: 0, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: delay,
                type: "spring",
                stiffness: 200,
              }}
            />

            {/* Neuron glow animation */}
             <motion.circle
               cx={neuron.x}
               cy={neuron.y}
               r={neuronSize * 0.6}
               fill="hsl(var(--accent))"
               fillOpacity="0.5"
               animate={{
                 fillOpacity: [0.3, 0.7, 0.3],
                 scale: [0.8, 1.1, 0.8],
              }}
              transition={{
                duration: 2 + neuron.layer * 0.5,
                delay: delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Core center bright point */}
            {isCore && (
              <motion.circle
                cx={neuron.x}
                cy={neuron.y}
                r="3"
                fill="white"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.9, 1, 0.9],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
          </motion.g>
        );
      })}

      {/* Random firing neurons - adds life to the network */}
      {[
        { x: 175, y: 120, delay: 0 },
        { x: 280, y: 180, delay: 1.5 },
        { x: 150, y: 270, delay: 3 },
        { x: 300, y: 260, delay: 4.5 },
        { x: 100, y: 180, delay: 6 },
      ].map((spark, i) => (
        <motion.circle
          key={`spark-${i}`}
          cx={spark.x}
          cy={spark.y}
          r="2"
          fill="hsl(var(--accent))"
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 2, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 0.8,
            delay: spark.delay,
            repeat: Infinity,
            repeatDelay: 7,
          }}
        />
      ))}
    </svg>
  );
}
