import { useMemo } from 'react';

const DynamicHeroBackground = () => {
  const particles = useMemo(() => Array.from({ length: 50 }), []);

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-background">
      <style>
        {`
          @keyframes move-particle {
            0% { transform: translate(var(--x-start), var(--y-start)); opacity: 0; }
            20%, 80% { opacity: 1; }
            100% { transform: translate(var(--x-end), var(--y-end)); opacity: 0; }
          }
          .particle {
            position: absolute;
            width: 3px;
            height: 3px;
            border-radius: 50%;
            background-color: hsl(var(--primary) / 0.2);
            animation: move-particle 20s linear infinite;
          }
        `}
      </style>
      <div className="relative w-full h-full">
        {particles.map((_, i) => {
          const size = Math.random() * 2 + 1;
          const style = {
            '--x-start': `${Math.random() * 100}vw`,
            '--y-start': `${Math.random() * 100}vh`,
            '--x-end': `${Math.random() * 100}vw`,
            '--y-end': `${Math.random() * 100}vh`,
            animationDuration: `${Math.random() * 20 + 15}s`,
            animationDelay: `-${Math.random() * 20}s`,
            width: `${size}px`,
            height: `${size}px`,
          };
          return <div key={i} className="particle" style={style as React.CSSProperties} />;
        })}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background"></div>
       <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent"></div>
    </div>
  );
};

export default DynamicHeroBackground;
