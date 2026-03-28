import { Capacitor, registerPlugin } from "@capacitor/core";
import { type Channel, LocalNotifications } from "@capacitor/local-notifications";

import type { Task } from "./db";
import { buildNativeReminderPlan, taskHasSchedule } from "./reminderRules";

const CHANNEL_ID = "lembra_eu_reminders";

type NativeNotificationStatus = {
  granted: boolean;
  canExactAlarm: boolean;
};

type ScheduleTaskOptions = {
  completedOccurrenceKeys?: string[];
  legacyCompletedDates?: string[];
};

type NativeReminderOccurrencePayload = {
  requestCodeBase: number;
  taskId: number;
  occurrenceKey: string;
  occurrenceDate: string;
  scheduledTime: string;
  title: string;
  body: string;
  earlyTitle?: string;
  earlyBody?: string;
  earlyAt?: number;
  mainAt: number;
  nagEndAt: number;
  nagIntervalMinutes: number;
};

type NativeRemindersPlugin = {
  syncTask: (options: {
    taskId: number;
    occurrences: NativeReminderOccurrencePayload[];
  }) => Promise<{ scheduled: number }>;
  cancelTask: (options: { taskId: number }) => Promise<void>;
  testAlarm: () => Promise<void>;
};

const NativeReminders = registerPlugin<NativeRemindersPlugin>("NativeReminders");

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function mapPermissionState(value?: string) {
  return value === "granted";
}

function mapPlanToNativePayload(plan: ReturnType<typeof buildNativeReminderPlan>[number]) {
  return {
    requestCodeBase: plan.requestCodeBase,
    taskId: plan.taskId,
    occurrenceKey: plan.occurrenceKey,
    occurrenceDate: plan.occurrenceDate,
    scheduledTime: plan.scheduledTime,
    title: plan.title,
    body: plan.body,
    earlyTitle: plan.earlyTitle,
    earlyBody: plan.earlyBody,
    earlyAt: plan.earlyAt?.getTime(),
    mainAt: plan.mainAt.getTime(),
    nagEndAt: plan.nagEndAt.getTime(),
    nagIntervalMinutes: plan.nagIntervalMinutes,
  } satisfies NativeReminderOccurrencePayload;
}

async function ensureAndroidChannel() {
  if (!isNativeAndroid()) {
    return;
  }

  const channel: Channel = {
    id: CHANNEL_ID,
    name: "Lembretes do Lembra Eu",
    description: "Notificacoes de lembretes agendados",
    importance: 5,
    visibility: 1,
    vibration: true,
    lightColor: "#7C3AED",
  };

  try {
    await LocalNotifications.createChannel(channel);
  } catch (error) {
    console.warn("[Scheduling] createChannel failed:", error);
  }
}

async function clearLegacyPendingNotifications() {
  if (!isNativeAndroid()) {
    return;
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length === 0) {
      return;
    }

    await LocalNotifications.cancel({
      notifications: pending.notifications.map((notification) => ({ id: notification.id })),
    });
  } catch (error) {
    console.warn("[Scheduling] clearLegacyPendingNotifications failed:", error);
  }
}

let nativeSetupPromise: Promise<void> | null = null;

export async function ensureNativeNotificationSetup() {
  if (!isNativeAndroid()) {
    return;
  }

  if (!nativeSetupPromise) {
    nativeSetupPromise = (async () => {
      await ensureAndroidChannel();
      await clearLegacyPendingNotifications();
    })();
  }

  await nativeSetupPromise;
}

export async function checkNotificationPermission(): Promise<NativeNotificationStatus> {
  if (!isNativeAndroid()) {
    return { granted: false, canExactAlarm: false };
  }

  try {
    const display = await LocalNotifications.checkPermissions();
    const exact = await LocalNotifications.checkExactNotificationSetting();
    return {
      granted: mapPermissionState(display.display),
      canExactAlarm: mapPermissionState(exact.exact_alarm),
    };
  } catch (error) {
    console.warn("[Scheduling] checkNotificationPermission failed:", error);
    return { granted: false, canExactAlarm: false };
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNativeAndroid()) {
    return false;
  }

  try {
    await ensureNativeNotificationSetup();
    const result = await LocalNotifications.requestPermissions();
    return mapPermissionState(result.display);
  } catch (error) {
    console.warn("[Scheduling] requestNotificationPermission failed:", error);
    return false;
  }
}

export async function openExactAlarmSettings() {
  if (!isNativeAndroid()) {
    return;
  }

  await LocalNotifications.changeExactNotificationSetting();
}

export async function testNotification(): Promise<boolean> {
  if (!isNativeAndroid()) {
    return false;
  }

  try {
    await ensureNativeNotificationSetup();
    await NativeReminders.testAlarm();
    return true;
  } catch (error) {
    console.error("[Scheduling] testNotification failed:", error);
    return false;
  }
}

export async function cancelTaskNotifications(taskId: number): Promise<void> {
  if (!isNativeAndroid()) {
    return;
  }

  try {
    await NativeReminders.cancelTask({ taskId });
  } catch (error) {
    console.warn(`[Scheduling] cancelTaskNotifications failed for task ${taskId}:`, error);
  }
}

export async function scheduleTaskNotifications(task: Task, options?: ScheduleTaskOptions): Promise<number> {
  if (!isNativeAndroid() || !task.id || !taskHasSchedule(task)) {
    return 0;
  }

  await ensureNativeNotificationSetup();

  const plan = buildNativeReminderPlan(task, options);
  try {
    if (plan.length === 0) {
      await NativeReminders.cancelTask({ taskId: task.id });
      return 0;
    }

    const result = await NativeReminders.syncTask({
      taskId: task.id,
      occurrences: plan.map(mapPlanToNativePayload),
    });
    return result.scheduled;
  } catch (error) {
    console.error(`[Scheduling] Failed to schedule task ${task.id}:`, error);
    return 0;
  }
}
