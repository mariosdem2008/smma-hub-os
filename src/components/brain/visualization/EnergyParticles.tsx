import { motion } from "framer-motion";
import { useMemo } from "react";

interface Particle {
  id: number;
  size: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
  orbitRadius: number;
}

interface EnergyParticlesProps {
  count?: number;
  className?: string;
}

export function EnergyParticles({ count = 20, className = "" }: EnergyParticlesProps) {
  // Generate particles with random properties
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 4,
      orbitRadius: Math.random() * 50 + 100,
    }));
  }, [count]);

  // Orbiting particles
  const orbitingParticles = useMemo<Particle[]>(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i + 100,
      size: 3,
      x: 50,
      y: 50,
      delay: i * 0.8,
      duration: 15 + i * 2,
      orbitRadius: 120 + i * 15,
    }));
  }, []);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Floating ambient particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            background: `radial-gradient(circle, hsl(var(--primary) / 0.8) 0%, hsl(var(--accent) / 0.4) 100%)`,
            boxShadow: `0 0 ${particle.size * 2}px hsl(var(--primary) / 0.5)`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.sin(particle.id) * 10, 0],
            opacity: [0.3, 0.7, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Orbiting particles around center */}
      <div className="absolute inset-0 flex items-center justify-center">
        {orbitingParticles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute"
            style={{
              width: particle.size,
              height: particle.size,
            }}
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <motion.div
              className="rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                transform: `translateX(${particle.orbitRadius}px)`,
                background: `hsl(var(--accent))`,
                boxShadow: `0 0 10px hsl(var(--accent) / 0.8), 0 0 20px hsl(var(--primary) / 0.4)`,
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: particle.delay * 0.3,
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Background gradient orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.1) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(var(--accent) / 0.1) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
        animate={{
          scale: [1, 1.3, 1],
          x: [0, -20, 0],
          y: [0, 30, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
    </div>
  );
}
