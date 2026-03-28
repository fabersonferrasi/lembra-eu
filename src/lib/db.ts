import Dexie, { type Table } from 'dexie';

export interface Task {
  id?: number;
  title: string;
  description?: string;
  category: 'personal' | 'work' | 'health' | 'routine' | 'study';
  earlyReminderMinutes?: number; // 0, 5, 10, 15, 30
  startDate: Date;
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'once' | 'custom';
  scheduleTime?: string; // HH:mm format
  daysOfWeek?: number[]; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  customSchedules?: { days: number[]; time: string }[];
  createdAt: Date;
}

export interface TaskLog {
  id?: number;
  taskId: number;
  completedAt: Date;
  isDoubleConfirmed: boolean;
  occurrenceKey?: string;
  occurrenceDate?: string;
  occurrenceTime?: string;
}

export interface UserContext {
  id?: number;
  role: 'adhd' | 'observer';
  name: string;
}

export class LembraEuDatabase extends Dexie {
  tasks!: Table<Task>;
  taskLogs!: Table<TaskLog>;
  users!: Table<UserContext>;

  constructor() {
    super('LembraEuDB');
    this.version(2).stores({
      tasks: '++id, scheduleType, category', // Added category to index
      taskLogs: '++id, taskId, completedAt',
      users: '++id, role'
    });
    this.version(3).stores({
      tasks: '++id, scheduleType, category',
      taskLogs: '++id, taskId, completedAt, occurrenceKey, occurrenceDate, occurrenceTime',
      users: '++id, role'
    });
  }
}

export const db = new LembraEuDatabase();
