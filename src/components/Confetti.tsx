"use client";

import { useEffect, useState } from "react";

export function Confetti() {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 10 + 5,
      color: ['#7C3AED', '#DB2777', '#F59E0B', '#10B981', '#3B82F6'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 1,
      duration: 1 + Math.random() * 2,
      rotation: Math.random() * 360
    }));
    setParticles(newParticles);
    
    const h = setTimeout(() => setParticles([]), 4000);
    return () => clearTimeout(h);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-out fade-out duration-1000 fill-mode-forwards"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            opacity: 0.8,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-100px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
