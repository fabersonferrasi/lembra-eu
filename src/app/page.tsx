"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Task } from "@/lib/db";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { Plus, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const [showForm, setShowForm] = useState(false);

  // Fetch pending tasks. For simplicity we fetch all tasks minus those logged as done today
  // In a real scenario, we'd do complex date math based on scheduleType
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const taskLogs = useLiveQuery(() => db.taskLogs.toArray(), []);

  // Filter tasks to show only those that need action today
  const pendingTasks = tasks?.filter(task => {
    // Check if there's a log for this task today
    const today = new Date().setHours(0, 0, 0, 0);
    const hasLogToday = taskLogs?.some(log => {
      const logDate = new Date(log.completedAt).setHours(0, 0, 0, 0);
      return log.taskId === task.id && logDate === today;
    });
    
    return !hasLogToday;
  });

  const handleCreateTask = async (taskData: any) => {
    await db.tasks.add(taskData);
    setShowForm(false);
  };

  const handleCompleteTask = async (taskId: number, isDoubleConfirmed: boolean) => {
    await db.taskLogs.add({
      taskId,
      completedAt: new Date(),
      isDoubleConfirmed,
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white px-6 pt-12 pb-6 rounded-b-[2.5rem] shadow-sm mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Lembra Eu</h1>
          <p className="text-slate-500 font-medium">Bora focar no que importa!</p>
        </div>
        <Link 
          href="/observer" 
          className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-200 transition-colors"
        >
          Visão Observador
        </Link>
      </header>

      <div className="px-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>Para hoje</span>
          <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-sm">
            {pendingTasks?.length || 0} pendentes
          </span>
        </h2>

        {pendingTasks === undefined ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="bg-emerald-50 rounded-3xl p-8 text-center border border-emerald-100 flex flex-col items-center">
            <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
            <h3 className="text-xl font-bold text-emerald-800 mb-2">Tudo limpo!</h3>
            <p className="text-emerald-600 font-medium">Você concluiu todas as suas ações do dia. Aproveite seu tempo cego sem preocupações!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task as any} 
                onComplete={handleCompleteTask} 
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-8 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all z-40"
      >
        <Plus size={32} />
      </button>

      {showForm && (
        <TaskForm 
          onSubmit={handleCreateTask} 
          onCancel={() => setShowForm(false)} 
        />
      )}
    </main>
  );
}
