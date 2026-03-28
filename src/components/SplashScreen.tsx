"use client";

import { useEffect, useState } from "react";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onFinish, 1000);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  if (!isVisible) return (
    <div className="fixed inset-0 bg-[#0f172a] z-[1000] animate-out fade-out duration-1000 fill-mode-forwards pointer-events-none"></div>
  );

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] z-[1000] flex flex-col items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15 mix-blend-overlay"></div>
      <div className="absolute w-[400px] h-[400px] bg-violet-600/20 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute w-[300px] h-[300px] bg-fuchsia-500/15 blur-[100px] rounded-full translate-y-20 animate-pulse delay-300"></div>
      
      {/* Logo Animation */}
      <div className="relative animate-in zoom-in-50 duration-1000 flex flex-col items-center">
        {/* Icon Container */}
        <div className="w-28 h-28 bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-orange-400 rounded-[2.2rem] shadow-2xl shadow-violet-500/40 flex items-center justify-center mb-8 relative border border-white/20 overflow-hidden">
          {/* Inner glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
          {/* Bell + Lightning SVG */}
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" className="relative z-10 drop-shadow-lg">
            {/* Bell */}
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="white" fillOpacity="0.15"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Lightning bolt */}
            <path d="M13 2l-2 5h3l-2 5" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)"/>
            <defs>
              <filter id="glow" x="-2" y="-2" width="28" height="28">
                <feGaussianBlur stdDeviation="1" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
          </svg>
        </div>
        
        <h1 className="text-5xl font-black tracking-tighter text-white mb-2 drop-shadow-lg">
          Lembra <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-amber-200">Eu</span>
        </h1>
        <p className="text-violet-300/70 font-semibold text-sm tracking-wider mt-1">
          Sua mente focada e em paz
        </p>
        
        <div className="flex gap-1.5 items-center mt-8">
           {[0, 1, 2].map((i) => (
             <div 
               key={i} 
               className="w-2 h-2 bg-gradient-to-r from-fuchsia-400 to-orange-300 rounded-full animate-bounce" 
               style={{ animationDelay: `${i * 0.2}s` }}
             ></div>
           ))}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-14 animate-in slide-in-from-bottom-8 duration-1000 delay-500">
        <p className="text-slate-500/50 font-black uppercase tracking-[0.4em] text-[9px]">Foco • Paz • Mente</p>
      </div>
    </div>
  );
}
