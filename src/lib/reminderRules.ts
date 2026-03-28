import { addDays, addMinutes, isSameDay, subMinutes } from "date-fns";

import type { Task } from "./db";

export type TaskOccurrence = {
  occurrenceIndex: number;
  taskId: number;
  occurrenceDate: string;
  scheduledTime: string;
  occurrenceKey: string;
  mainFireAt: Date;
  title: string;
  body: string;
};

export type NativeReminderPlanItem = {
  requestCodeBase: number;
  taskId: number;
  occurrenceKey: string;
  occurrenceDate: string;
  scheduledTime: string;
  title: string;
  body: string;
  earlyTitle?: string;
  earlyBody?: string;
  earlyAt?: Date;
  mainAt: Date;
  nagEndAt: Date;
  nagIntervalMinutes: number;
};

type ReminderPlanOptions = {
  completedOccurrenceKeys?: string[];
  legacyCompletedDates?: string[];
  now?: Date;
};

const REMINDER_HORIZON_DAYS = 30;
export const NAG_INTERVAL_MINUTES = 2;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 58, 0, 0);
}

function parseTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return { hours, minutes };
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStartDate(task: Task) {
  const base = new Date(task.startDate);
  return startOfDay(base);
}

function getWeeklyDays(task: Task) {
  if (task.daysOfWeek?.length) {
    return task.daysOfWeek;
  }

  return [getStartDate(task).getDay()];
}

function getMonthlyDay(task: Task) {
  if (task.dayOfMonth) {
    return task.dayOfMonth;
  }

  return getStartDate(task).getDate();
}

function toSet(values?: string[]) {
  return new Set((values || []).filter(Boolean));
}

export function createOccurrenceKey(taskId: number, occurrenceDate: string, scheduledTime: string) {
  return `${taskId}:${occurrenceDate}:${scheduledTime}`;
}

export function taskHasSchedule(task: Task) {
  if (task.scheduleType === "custom") {
    return !!task.customSchedules?.some((entry) => entry.time && entry.days.length > 0);
  }

  return !!task.scheduleTime;
}

export function getTaskTimesForDate(task: Task, date: Date) {
  if (!taskHasSchedule(task)) {
    return [];
  }

  const normalizedDate = startOfDay(date);
  const taskStartDate = getStartDate(task);
  if (normalizedDate < taskStartDate) {
    return [];
  }

  if (task.scheduleType === "custom") {
    return (task.customSchedules || [])
      .filter((entry) => entry.days.includes(normalizedDate.getDay()) && !!parseTime(entry.time))
      .map((entry) => entry.time)
      .sort();
  }

  if (!task.scheduleTime || !parseTime(task.scheduleTime)) {
    return [];
  }

  if (task.scheduleType === "daily") {
    return [task.scheduleTime];
  }

  if (task.scheduleType === "weekly") {
    return getWeeklyDays(task).includes(normalizedDate.getDay()) ? [task.scheduleTime] : [];
  }

  if (task.scheduleType === "monthly") {
    return normalizedDate.getDate() === getMonthlyDay(task) ? [task.scheduleTime] : [];
  }

  if (task.scheduleType === "once") {
    return isSameDay(normalizedDate, taskStartDate) ? [task.scheduleTime] : [];
  }

  return [];
}

export function taskOccursOnDate(task: Task, date: Date) {
  return getTaskTimesForDate(task, date).length > 0;
}

export function getTaskOccurrencesForDate(task: Task, date: Date) {
  if (!task.id || !taskHasSchedule(task)) {
    return [] as TaskOccurrence[];
  }

  const normalizedDate = startOfDay(date);
  const times = getTaskTimesForDate(task, normalizedDate);

  return times
    .map((time, occurrenceIndex) => {
      const parsed = parseTime(time);
      if (!parsed) {
        return null;
      }

      const mainFireAt = new Date(normalizedDate);
      mainFireAt.setHours(parsed.hours, parsed.minutes, 0, 0);

      const occurrenceDate = formatDateKey(normalizedDate);
      return {
        occurrenceIndex,
        taskId: task.id!,
        occurrenceDate,
        scheduledTime: time,
        occurrenceKey: createOccurrenceKey(task.id!, occurrenceDate, time),
        mainFireAt,
        title: task.title,
        body: task.description || "Hora da sua tarefa!",
      };
    })
    .filter((occurrence): occurrence is TaskOccurrence => occurrence !== null)
    .sort((a, b) => a.mainFireAt.getTime() - b.mainFireAt.getTime());
}

function shouldSkipOccurrence(
  occurrence: TaskOccurrence,
  completedOccurrenceKeys: Set<string>,
  legacyCompletedDates: Set<string>,
) {
  if (completedOccurrenceKeys.has(occurrence.occurrenceKey)) {
    return true;
  }

  return legacyCompletedDates.has(occurrence.occurrenceDate);
}

function collectOccurrences(task: Task, options?: ReminderPlanOptions) {
  if (!task.id || !taskHasSchedule(task)) {
    return [] as TaskOccurrence[];
  }

  const now = options?.now ?? new Date();
  const today = startOfDay(now);
  const scanStart = getStartDate(task) > today ? getStartDate(task) : today;
  const completedOccurrenceKeys = toSet(options?.completedOccurrenceKeys);
  const legacyCompletedDates = toSet(options?.legacyCompletedDates);

  const occurrences: TaskOccurrence[] = [];
  let occurrenceIndex = 0;

  for (let offset = 0; offset <= REMINDER_HORIZON_DAYS; offset++) {
    const targetDate = addDays(scanStart, offset);
    const dailyOccurrences = getTaskOccurrencesForDate(task, targetDate);

    for (const occurrence of dailyOccurrences) {
      const withIndex = {
        ...occurrence,
        occurrenceIndex,
      };

      occurrenceIndex++;

      if (shouldSkipOccurrence(withIndex, completedOccurrenceKeys, legacyCompletedDates)) {
        continue;
      }

      if (!isSameDay(withIndex.mainFireAt, today) && withIndex.mainFireAt.getTime() <= now.getTime()) {
        continue;
      }

      occurrences.push(withIndex);
    }
  }

  return occurrences.sort((a, b) => a.mainFireAt.getTime() - b.mainFireAt.getTime());
}

function getNagEndAt(occurrences: TaskOccurrence[], occurrenceIndex: number) {
  const occurrence = occurrences[occurrenceIndex];
  let nagEndAt = endOfDay(occurrence.mainFireAt);

  for (let index = occurrenceIndex + 1; index < occurrences.length; index++) {
    const candidate = occurrences[index];
    if (candidate.taskId !== occurrence.taskId) {
      continue;
    }

    if (candidate.occurrenceDate === occurrence.occurrenceDate) {
      nagEndAt = subMinutes(candidate.mainFireAt, NAG_INTERVAL_MINUTES);
      break;
    }
  }

  return nagEndAt;
}

export function buildNativeReminderPlan(task: Task, options?: ReminderPlanOptions) {
  if (!task.id || !taskHasSchedule(task)) {
    return [] as NativeReminderPlanItem[];
  }

  const now = options?.now ?? new Date();
  const occurrences = collectOccurrences(task, options);
  const plan: NativeReminderPlanItem[] = [];

  occurrences.forEach((occurrence, index) => {
    const requestCodeBase = task.id! * 100000 + occurrence.occurrenceIndex * 10;
    const nagEndAt = getNagEndAt(occurrences, index);
    const earlyAt =
      task.earlyReminderMinutes && task.earlyReminderMinutes > 0
        ? addMinutes(occurrence.mainFireAt, -task.earlyReminderMinutes)
        : null;

    const shouldKeepEarly = !!earlyAt && earlyAt.getTime() > now.getTime();
    const shouldKeepMain = occurrence.mainFireAt.getTime() > now.getTime();
    const shouldKeepNag = nagEndAt.getTime() > now.getTime();

    if (!shouldKeepEarly && !shouldKeepMain && !shouldKeepNag) {
      return;
    }

    plan.push({
      requestCodeBase,
      taskId: occurrence.taskId,
      occurrenceKey: occurrence.occurrenceKey,
      occurrenceDate: occurrence.occurrenceDate,
      scheduledTime: occurrence.scheduledTime,
      title: occurrence.title,
      body: occurrence.body,
      earlyTitle: shouldKeepEarly ? `Prepara: ${occurrence.title}` : undefined,
      earlyBody:
        shouldKeepEarly && task.earlyReminderMinutes
          ? `Faltam ${task.earlyReminderMinutes} minutos para: ${occurrence.title}`
          : undefined,
      earlyAt: shouldKeepEarly ? earlyAt! : undefined,
      mainAt: occurrence.mainFireAt,
      nagEndAt,
      nagIntervalMinutes: NAG_INTERVAL_MINUTES,
    });
  });

  return plan.sort((a, b) => a.mainAt.getTime() - b.mainAt.getTime());
}
