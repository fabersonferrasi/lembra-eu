"use client";

import { useEffect, useState } from "react";

import { useLiveQuery } from "dexie-react-hooks";
import { BellRing, ShieldAlert, Zap } from "lucide-react";

import { db, type TaskLog } from "@/lib/db";
import { getTaskTimesForDate, taskHasSchedule } from "@/lib/reminderRules";
import {
  checkNotificationPermission,
  ensureNativeNotificationSetup,
  openExactAlarmSettings,
  requestNotificationPermission,
  scheduleTaskNotifications,
  testNotification,
} from "@/lib/scheduling";

type PermissionState = "loading" | "granted" | "denied" | "prompt";
type AndroidSettingsPlugin = {
  openBatterySettings: () => Promise<void>;
  checkBatteryOptimization: () => Promise<{ ignoring: boolean }>;
};

function getCompletionState(taskId: number, logs: TaskLog[]) {
  const completedOccurrenceKeys = new Set<string>();
  const legacyCompletedDates = new Set<string>();

  logs
    .filter((log) => log.taskId === taskId)
    .forEach((log) => {
      if (log.occurrenceKey) {
        completedOccurrenceKeys.add(log.occurrenceKey);
        return;
      }

      if (log.occurrenceDate) {
        legacyCompletedDates.add(log.occurrenceDate);
        return;
      }

      const completedAt = new Date(log.completedAt);
      const year = completedAt.getFullYear();
      const month = String(completedAt.getMonth() + 1).padStart(2, "0");
      const day = String(completedAt.getDate()).padStart(2, "0");
      legacyCompletedDates.add(`${year}-${month}-${day}`);
    });

  return {
    completedOccurrenceKeys: [...completedOccurrenceKeys],
    legacyCompletedDates: [...legacyCompletedDates],
  };
}

async function getAndroidSettings() {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<AndroidSettingsPlugin>("AndroidSettings");
}

export function NotificationManager() {
  const [permState, setPermState] = useState<PermissionState>("loading");
  const [exactAlarm, setExactAlarm] = useState(true);
  const [batterySafe, setBatterySafe] = useState(true);
  const [isNative, setIsNative] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const taskLogs = useLiveQuery(() => db.taskLogs.toArray(), []);

  useEffect(() => {
    const init = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
        setIsNative(native);

        if (native) {
          await ensureNativeNotificationSetup();
          const permission = await checkNotificationPermission();
          setPermState(permission.granted ? "granted" : "prompt");
          setExactAlarm(permission.canExactAlarm);

          try {
            const settings = await getAndroidSettings();
            const battery = await settings.checkBatteryOptimization();
            setBatterySafe(battery.ignoring);
          } catch {
            setBatterySafe(true);
          }
          return;
        }
      } catch {
        // Browser fallback below.
      }

      if (typeof window !== "undefined" && "Notification" in window) {
        const permission = Notification.permission;
        setPermState(
          permission === "granted"
            ? "granted"
            : permission === "denied"
              ? "denied"
              : "prompt",
        );
      } else {
        setPermState("granted");
      }
    };

    void init();
  }, []);

  useEffect(() => {
    if (!tasks || !taskLogs || !isNative || permState !== "granted") {
      return;
    }

    const syncAndReschedule = async () => {
      for (const task of tasks) {
        if (!task.id || !taskHasSchedule(task)) {
          continue;
        }

        try {
          const completionState = getCompletionState(task.id, taskLogs);
          await scheduleTaskNotifications(task, completionState);
        } catch (error) {
          console.warn(`[NotifMgr] Failed to schedule task ${task.id}:`, error);
        }
      }
    };

    void syncAndReschedule();

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void (async () => {
        const permission = await checkNotificationPermission();
        setExactAlarm(permission.canExactAlarm);

        try {
          const settings = await getAndroidSettings();
          const battery = await settings.checkBatteryOptimization();
          setBatterySafe(battery.ignoring);
        } catch {
          setBatterySafe(true);
        }

        await syncAndReschedule();
      })();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tasks, taskLogs, isNative, permState]);

  const handleRequestPermission = async () => {
    if (isNative) {
      const granted = await requestNotificationPermission();
      const permission = await checkNotificationPermission();
      setPermState(granted ? "granted" : "denied");
      setExactAlarm(permission.canExactAlarm);
      return;
    }

    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setPermState(permission === "granted" ? "granted" : "denied");
    }
  };

  const handleOpenAlarmSettings = async () => {
    try {
      await openExactAlarmSettings();
      setTimeout(async () => {
        const permission = await checkNotificationPermission();
        setExactAlarm(permission.canExactAlarm);
      }, 1500);
    } catch {
      // Ignore settings navigation failures.
    }
  };

  const handleOpenBatterySettings = async () => {
    try {
      const settings = await getAndroidSettings();
      await settings.openBatterySettings();
      setTimeout(async () => {
        const battery = await settings.checkBatteryOptimization();
        setBatterySafe(battery.ignoring);
      }, 1500);
    } catch {
      // Ignore settings navigation failures.
    }
  };

  const handleTestNotification = async () => {
    setTestResult("sending");
    const ok = await testNotification();
    setTestResult(ok ? "ok" : "failed");
    setTimeout(() => setTestResult(null), 5000);
  };

  useEffect(() => {
    if (!tasks || permState !== "granted" || isNative) {
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];

      tasks.forEach((task) => {
        if (!taskHasSchedule(task)) {
          return;
        }

        const storageKey = `notified_${task.id}_${todayStr}`;
        if (localStorage.getItem(storageKey)) {
          return;
        }

        const [taskTime] = getTaskTimesForDate(task, now);
        if (!taskTime) {
          return;
        }

        const [hours, minutes] = taskTime.split(":").map(Number);
        const fireAt = new Date();
        fireAt.setHours(hours, minutes, 0, 0);
        if (now < fireAt) {
          return;
        }

        void db.taskLogs.where({ taskId: task.id }).toArray().then((logs) => {
          const todayStart = new Date().setHours(0, 0, 0, 0);
          const alreadyDone = logs.some(
            (log) => new Date(log.completedAt).setHours(0, 0, 0, 0) === todayStart,
          );

          if (alreadyDone) {
            return;
          }

          localStorage.setItem(storageKey, "true");
          if ("serviceWorker" in navigator) {
            void navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(`Lembrete: ${task.title}`, {
                body: task.description || "Hora da tarefa!",
                icon: "/icon-192x192.png",
              });
            });
          }
        });
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [tasks, permState, isNative]);

  if (permState === "loading") {
    return null;
  }

  if (permState === "prompt" || permState === "denied") {
    return (
      <div className="fixed top-4 left-4 right-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-4 rounded-2xl shadow-lg z-40 animate-in slide-in-from-top-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <BellRing size={22} className="animate-pulse" />
          </div>
          <div>
            <p className="font-black text-sm">Ativar notificacoes</p>
            <p className="text-xs text-white/80">
              {permState === "denied"
                ? "Permissao negada. Toque para tentar novamente."
                : "Necessario para receber lembretes mesmo com o app fechado."}
            </p>
          </div>
        </div>
        <button
          onClick={handleRequestPermission}
          className="w-full bg-white text-violet-700 py-2.5 rounded-xl text-sm font-black shadow-sm active:scale-95 transition-all"
        >
          {permState === "denied" ? "Permitir novamente" : "Permitir notificacoes"}
        </button>
      </div>
    );
  }

  if (permState === "granted" && isNative && (!exactAlarm || !batterySafe)) {
    return (
      <div className="fixed top-4 left-4 right-4 bg-orange-600 text-white p-4 rounded-2xl shadow-lg flex flex-col gap-3 z-40 animate-in slide-in-from-top-4">
        <div className="flex items-start gap-3">
          {!exactAlarm ? (
            <ShieldAlert size={24} className="flex-shrink-0 mt-0.5" />
          ) : (
            <Zap size={24} className="flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold text-sm">Ajustes do Android ainda pendentes</p>
            <p className="text-xs text-orange-100">
              {!exactAlarm
                ? "Sem alarme exato, o S24+ pode atrasar ou ignorar o lembrete."
                : "A economia de bateria da Samsung pode impedir alarmes em segundo plano."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!exactAlarm ? (
            <button
              onClick={handleOpenAlarmSettings}
              className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-xs font-bold"
            >
              Autorizar alarme exato
            </button>
          ) : (
            <button
              onClick={handleOpenBatterySettings}
              className="flex-1 bg-white text-orange-600 py-2 rounded-xl text-xs font-bold"
            >
              Ajustar bateria
            </button>
          )}
          <button
            onClick={handleTestNotification}
            className="bg-orange-700 px-3 py-2 rounded-xl text-[10px] font-bold"
          >
            Testar
          </button>
        </div>
        {!exactAlarm && !batterySafe ? (
          <button
            onClick={handleOpenBatterySettings}
            className="w-full bg-orange-700/70 py-2 rounded-xl text-xs font-bold"
          >
            Depois, liberar economia de bateria
          </button>
        ) : null}
      </div>
    );
  }

  if (permState === "granted" && isNative && testResult !== null) {
    return (
      <div
        className={`fixed top-4 left-4 right-4 p-3 rounded-2xl shadow-lg z-40 text-center text-sm font-bold ${
          testResult === "ok"
            ? "bg-emerald-500 text-white"
            : testResult === "failed"
              ? "bg-rose-500 text-white"
              : "bg-slate-700 text-white"
        }`}
      >
        {testResult === "sending"
          ? "Enviando teste..."
          : testResult === "ok"
            ? "Notificacao de teste agendada para 5 segundos"
            : "Falha ao agendar notificacao de teste"}
      </div>
    );
  }

  return null;
}

export { testNotification };
