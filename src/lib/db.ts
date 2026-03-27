import Dexie, { type Table } from 'dexie';

export interface Task {
  id?: number;
  title: string;
  description?: string;
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'once';
  scheduleTime?: string; // HH:mm format
  daysOfWeek?: number[]; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  createdAt: Date;
}

export interface TaskLog {
  id?: number;
  taskId: number;
  completedAt: Date;
  isDoubleConfirmed: boolean;
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
    this.version(1).stores({
      tasks: '++id, scheduleType', // Primary key and indexed props
      taskLogs: '++id, taskId, completedAt',
      users: '++id, role'
    });
  }
}

export const db = new LembraEuDatabase();
