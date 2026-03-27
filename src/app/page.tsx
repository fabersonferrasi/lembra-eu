"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Task } from "@/lib/db";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { NotificationManager } from "@/components/NotificationManager";
import { Plus, CheckCircle2, ListFilter } from "lucide-react";
import Link from "next/link";

type ViewType = "today" | "daily" | "weekly" | "monthly";

export default function HomePage() {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [activeView, setActiveView] = useState<ViewType>("today");

  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const taskLogs = useLiveQuery(() => db.taskLogs.toArray(), []);

  // Filter tasks to show those that need action today
  const pendingForToday = tasks?.filter(task => {
    const today = new Date().setHours(0, 0, 0, 0);
    const hasLogToday = taskLogs?.some(log => {
      const logDate = new Date(log.completedAt).setHours(0, 0, 0, 0);
      return log.taskId === task.id && logDate === today;
    });
    return !hasLogToday;
  });

  const handleCreateOrUpdateTask = async (taskData: any) => {
    if (taskData.id) {
      await db.tasks.update(taskData.id, taskData);
    } else {
      await db.tasks.add(taskData);
    }
    setShowForm(false);
    setEditingTask(null);
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleDeleteTask = async (taskId: number) => {
    if (confirm("Você tem certeza que deseja excluir este lembrete?")) {
      await db.tasks.delete(taskId);
      // Clean up logs associated
      const logsToDel = await db.taskLogs.where({ taskId }).toArray();
      await db.taskLogs.bulkDelete(logsToDel.map(l => l.id!));
    }
  };

  const handleCompleteTask = async (taskId: number, isDoubleConfirmed: boolean) => {
    await db.taskLogs.add({
      taskId,
      completedAt: new Date(),
      isDoubleConfirmed,
    });
  };

  const getVisibleTasks = () => {
    if (!tasks) return undefined;
    if (activeView === "today") return pendingForToday;
    return tasks.filter(t => t.scheduleType === activeView);
  };

  const visibleTasks = getVisibleTasks();

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <NotificationManager />
      
      <header className="bg-white px-6 pt-12 pb-6 rounded-b-[2.5rem] shadow-sm mb-6 flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Lembra Eu</h1>
            <p className="text-slate-500 font-medium">Bora focar no que importa!</p>
          </div>
          <Link 
            href="/observer" 
            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-200 transition-colors"
          >
            Observador
          </Link>
        </div>

        {/* View Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto scroolbar-hide snap-x">
          <button 
            onClick={() => setActiveView("today")}
            className={`flex-1 min-w-[80px] text-sm font-bold py-2 px-3 rounded-xl transition-all ${activeView === "today" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
          >
            Para Hoje
          </button>
          <button 
            onClick={() => setActiveView("daily")}
            className={`flex-1 min-w-[80px] text-sm font-bold py-2 px-3 rounded-xl transition-all ${activeView === "daily" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
          >
            Diárias
          </button>
          <button 
            onClick={() => setActiveView("weekly")}
            className={`flex-1 min-w-[80px] text-sm font-bold py-2 px-3 rounded-xl transition-all ${activeView === "weekly" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
          >
            Semanais
          </button>
          <button 
            onClick={() => setActiveView("monthly")}
            className={`flex-1 min-w-[80px] text-sm font-bold py-2 px-3 rounded-xl transition-all ${activeView === "monthly" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
          >
            Mensais
          </button>
        </div>
      </header>

      <div className="px-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListFilter size={18} className="text-slate-400" />
            {activeView === "today" ? "Sua fila de hoje" : "Gerenciar Tarefas"}
          </span>
          <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-sm">
            {visibleTasks?.length || 0}
          </span>
        </h2>

        {visibleTasks === undefined ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm flex flex-col items-center">
            {activeView === "today" ? (
              <>
                <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Tudo limpo!</h3>
                <p className="text-slate-500 font-medium">Você não tem ações pendentes para hoje. Aproveite o seu dia!</p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Nenhuma tarefa</h3>
                <p className="text-slate-500 font-medium">Você ainda não tem tarefas cadastradas nesta categoria.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task as any} 
                onComplete={handleCompleteTask} 
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => { setEditingTask(null); setShowForm(true); }}
        className="fixed bottom-8 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all z-30"
      >
        <Plus size={32} />
      </button>

      {showForm && (
        <TaskForm 
          initialData={editingTask}
          onSubmit={handleCreateOrUpdateTask} 
          onCancel={() => { setShowForm(false); setEditingTask(null); }} 
        />
      )}
    </main>
  );
}
