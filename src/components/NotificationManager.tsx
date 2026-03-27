"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { BellRing } from "lucide-react";

export function NotificationManager() {
  const [permission, setPermission] = useState<string>("granted");
  
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  
  // Play a simple beep sound using Web Audio API so we don't need external assets
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio API not supported", e);
    }
  };

  const requestPermission = async () => {
    if ("Notification" in window) {
      const p = await Notification.requestPermission();
      setPermission(p);
    }
  };

  useEffect(() => {
    if (!tasks || permission !== "granted") return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const timeString = `${currentHours}:${currentMinutes}`;
      
      tasks.forEach(task => {
        if (task.scheduleTime === timeString) {
          db.taskLogs.where({ taskId: task.id }).toArray().then(logs => {
            const today = new Date().setHours(0, 0, 0, 0);
            const hasLogToday = logs.some(log => {
              const logDate = new Date(log.completedAt).setHours(0, 0, 0, 0);
              return logDate === today;
            });
            
            const notifiedKey = `notified_${task.id}_${today}`;
            if (!hasLogToday && !sessionStorage.getItem(notifiedKey)) {
              sessionStorage.setItem(notifiedKey, "true");
              playBeep();
              
              if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.showNotification(`Lembrete: ${task.title}`, {
                    body: task.description || "É hora de executar essa tarefa!",
                    icon: "/icon-192x192.png",
                    vibrate: [200, 100, 200, 100, 200]
                  } as any);
                }).catch(() => {
                  new Notification(`Lembrete: ${task.title}`, { body: task.description });
                });
              } else {
                new Notification(`Lembrete: ${task.title}`, { body: task.description });
              }
            }
          });
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [tasks, permission]);

  if (permission === "default") {
    return (
      <div className="fixed top-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between z-40 animate-in slide-in-from-top-4">
        <div className="flex items-center gap-3">
          <BellRing size={24} className="animate-pulse" />
          <div>
            <p className="font-bold text-sm">Notificações</p>
            <p className="text-xs text-blue-100">Ative para ser avisado na hora certa.</p>
          </div>
        </div>
        <button onClick={requestPermission} className="bg-white text-blue-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm whitespace-nowrap">
          Ativar
        </button>
      </div>
    );
  }

  return null;
}
