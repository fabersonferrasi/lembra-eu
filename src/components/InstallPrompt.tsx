"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Optionally, check if it's already installed
    window.addEventListener("appinstalled", () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    
    // We can't use the prompt again
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 bg-white p-4 rounded-2xl shadow-xl flex items-center justify-between border border-blue-100 z-40 animate-in slide-in-from-bottom-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
          <Download size={20} />
        </div>
        <div>
          <p className="font-bold text-sm text-slate-800">Instalar App</p>
          <p className="text-xs text-slate-500">Adicione à tela inicial para acesso offline.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setIsVisible(false)}
          className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors"
        >
          <X size={18} />
        </button>
        <button 
          onClick={handleInstallClick}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors"
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
