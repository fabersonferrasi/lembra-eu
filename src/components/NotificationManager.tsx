"use client";

import { useEffect, useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { BellRing, Info } from "lucide-react";

export function NotificationManager() {
  const [permission, setPermission] = useState<string>("granted");
  const [showIosWarning, setShowIosWarning] = useState(false);
  
  // Track Scheduled IDs to prevent overriding constantly
  const scheduledTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      
      // Simple iOS Safari check
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS && !('showTrigger' in Notification.prototype)) {
        setShowIosWarning(true);
      }
    }
  }, []);

  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  
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

  // 1. Experimental background OS scheduling for PWA (Android / Chrome 107+)
  const scheduleBackgroundNotifications = async () => {
    if (!("serviceWorker" in navigator)) return;
    
    // Check if OS supports scheduling notifications (Trigger API)
    if (!('showTrigger' in Notification.prototype)) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      if (!tasks) return;

      const now = new Date();
      const today = now.getDay();
      
      // Get all scheduled notifications to avoid duplicates (if API supports getting them)
      let existingTags = new Set<string>();
      if (reg.getNotifications) {
        const activeNotes = await reg.getNotifications();
        activeNotes.forEach(n => existingTags.add(n.tag));
      }

      tasks.forEach(task => {
        if (!task.scheduleTime && task.scheduleType !== "custom") return;

        // Determine if task needs scheduling today
        let hours = 0, mins = 0;
        let shouldScheduleToday = false;
        
        if (task.scheduleType === "custom" && task.customSchedules) {
          const match = task.customSchedules.find(cs => cs.days.includes(today));
          if (match && match.time) {
            shouldScheduleToday = true;
            [hours, mins] = match.time.split(':').map(Number);
          }
        } else if (task.scheduleTime) {
          shouldScheduleToday = true;
          [hours, mins] = task.scheduleTime.split(':').map(Number);
        }

        if (shouldScheduleToday) {
          const scheduleDate = new Date();
          scheduleDate.setHours(hours, mins, 0, 0);

          // Only schedule if it's in the future
          if (scheduleDate.getTime() > now.getTime()) {
            const tag = `task_${task.id}_${scheduleDate.getTime()}`;
            
            // Check if already scheduled locally
            if (!scheduledTasksRef.current.has(tag) && !existingTags.has(tag)) {
              console.log(`Scheduling OS Notification for: ${task.title} at ${scheduleDate.toLocaleTimeString()}`);
              
              const options: any = {
                body: task.description || "É hora de executar essa tarefa!",
                icon: "/icon-192x192.png",
                vibrate: [200, 100, 200, 100, 200],
                tag: tag, // Prevent duplicates
                data: { taskId: task.id },
                actions: [
                  { action: 'confirm', title: '✓ Já fiz!' },
                  { action: 'close', title: 'X Depois' }
                ],
                showTrigger: new (window as any).TimestampTrigger(scheduleDate.getTime())
              };

              reg.showNotification(`Lembrete: ${task.title}`, options)
                .then(() => {
                   scheduledTasksRef.current.add(tag);
                })
                .catch(e => console.error("Trigger API failed", e));
            }
          }
        }
      });
    } catch (e) {
      console.log("Could not schedule background notification", e);
    }
  };

  // 2. Active foreground check (Fallback for iOS and desktop browsers)
  useEffect(() => {
    if (!tasks || permission !== "granted") return;
    
    // Immediately attempt to schedule OS background triggers
    scheduleBackgroundNotifications();
    
    const interval = setInterval(() => {
      const now = new Date();
      const currentDay = now.getDay(); // 0-6
      const todayStr = now.toISOString().split('T')[0];
      
      tasks.forEach(task => {
        let isTimeReached = false;
        
        // Find the target time for today (if applicable)
        if (task.scheduleType === "custom" && task.customSchedules) {
          const match = task.customSchedules.find(cs => cs.days.includes(currentDay));
          if (match && match.time) {
            const [hours, mins] = match.time.split(':').map(Number);
            const taskTime = new Date();
            taskTime.setHours(hours, mins, 0, 0);
            
            if (now.getTime() >= taskTime.getTime()) {
              isTimeReached = true;
            }
          }
        } else if (task.scheduleTime) {
          const [hours, mins] = task.scheduleTime.split(':').map(Number);
          const taskTime = new Date();
          taskTime.setHours(hours, mins, 0, 0);
          
          if (now.getTime() >= taskTime.getTime()) {
            isTimeReached = true;
          }
        }

        if (isTimeReached) {
          db.taskLogs.where({ taskId: task.id }).toArray().then(logs => {
            const todayStart = new Date().setHours(0, 0, 0, 0);
            const hasLogToday = logs.some(log => {
              const logDate = new Date(log.completedAt).setHours(0, 0, 0, 0);
              return logDate === todayStart;
            });
            
            const notifiedKey = `notified_${task.id}_${todayStr}`;
            const hasBeenNotified = localStorage.getItem(notifiedKey);

            if (!hasLogToday && !hasBeenNotified) {
              // Mark as notified in persistent storage so a reload doesn't blast it again
              localStorage.setItem(notifiedKey, "true");
              playBeep();
              
              if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(reg => {
                  reg.showNotification(`Lembrete: ${task.title}`, {
                    body: task.description || "É hora de executar essa tarefa!",
                    icon: "/icon-192x192.png",
                    vibrate: [200, 100, 200, 100, 200],
                    data: { taskId: task.id },
                    actions: [
                      { action: 'confirm', title: '✓ Já fiz!' },
                      { action: 'close', title: 'X Depois' }
                    ]
                  } as any);
                }).catch(() => {
                  new Notification(`Lembrete: ${task.title}`, { body: task.description });
                });
              } else {
                if (!('showTrigger' in Notification.prototype)) {
                   new Notification(`Lembrete: ${task.title}`, { body: task.description });
                }
              }
            }
          });
        }
      });
    }, 15000); // More aggressive: check every 15 seconds

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

  if (permission === "granted" && showIosWarning) {
    return (
      <div className="bg-slate-800 text-slate-200 p-3 text-xs flex items-start gap-2 justify-center opacity-80 fixed top-0 w-full z-40">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-blue-400" />
        <p>
          Dispositivos Apple precisam que você <b>não feche</b> inteiramente o site (deixe a aba aberta em segundo plano) para o alarme tocar no horário.
        </p>
        <button onClick={() => setShowIosWarning(false)} className="ml-2 px-2 py-0.5 bg-slate-700 rounded text-slate-300 font-bold hover:bg-slate-600">OK</button>
      </div>
    );
  }

  return null;
}
