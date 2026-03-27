"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Task } from "@/lib/db";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { NotificationManager } from "@/components/NotificationManager";
import { Plus, CheckCircle2, Calendar as CalendarIcon, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, X, User } from "lucide-react";
import Link from "next/link";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewTab = "today" | "week" | "month";

export default function HomePage() {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  
  // For Calendar Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  // For Day Detail Popup
  const [selectedDatePopup, setSelectedDatePopup] = useState<Date | null>(null);

  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const taskLogs = useLiveQuery(() => db.taskLogs.toArray(), []);

  // Helpers to calculate valid tasks for any given day
  const getTasksForDate = (date: Date) => {
    if (!tasks) return [];
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    
    return tasks.filter(task => {
      if (task.scheduleType === "daily") return true;
      if (task.scheduleType === "weekly" || task.scheduleType === "monthly" || task.scheduleType === "once") {
        return true; // Simple fallback to show in all dates for MVP if not custom/daily
      }
      if (task.scheduleType === "custom" && task.customSchedules) {
        return task.customSchedules.some(cs => cs.days.includes(dayOfWeek));
      }
      return false;
    });
  };

  const isTaskCompletedOnDate = (taskId: number, date: Date) => {
    if (!taskLogs) return false;
    const targetDate = new Date(date).setHours(0, 0, 0, 0);
    return taskLogs.some(log => {
      const logDate = new Date(log.completedAt).setHours(0, 0, 0, 0);
      return log.taskId === taskId && logDate === targetDate;
    });
  };

  const getPendingTasksForDate = (date: Date) => {
    const allForDate = getTasksForDate(date);
    return allForDate.filter(t => !isTaskCompletedOnDate(t.id!, date));
  };

  // ---------------- Handlers ----------------
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
    if (selectedDatePopup) setSelectedDatePopup(null); // Close popup to edit
  };

  const handleDeleteTask = async (taskId: number) => {
    if (confirm("Você tem certeza que deseja excluir este lembrete?")) {
      await db.tasks.delete(taskId);
      const logsToDel = await db.taskLogs.where({ taskId }).toArray();
      await db.taskLogs.bulkDelete(logsToDel.map(l => l.id!));
    }
  };

  const handleCompleteTask = async (taskId: number, isDoubleConfirmed: boolean) => {
    // Determine the target date: if a popup is open, we complete it for that specific date (simplified for MVP as today)
    // Actually Dexie log only cares about the timestamp, we log now().
    await db.taskLogs.add({
      taskId,
      completedAt: new Date(),
      isDoubleConfirmed,
    });
  };

  // ---------------- Views Renderers ----------------
  
  const renderAgendaTasks = (date: Date) => {
    const pendingTasks = getPendingTasksForDate(date);
    const completedCount = getTasksForDate(date).length - pendingTasks.length;

    return (
      <div className="px-6 pb-24">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>{isSameDay(date, new Date()) ? "Para Hoje" : format(date, "dd 'de' MMMM", { locale: ptBR })}</span>
          <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-sm font-bold">
            {pendingTasks.length} pendentes
          </span>
        </h2>

        {tasks === undefined ? (
           <div className="flex justify-center p-8"><div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div></div>
        ) : pendingTasks.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm flex flex-col items-center">
            <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Tudo limpo!</h3>
            <p className="text-slate-500 font-medium text-sm">Nenhuma ação pendente neste dia. Vá curtir a vida!</p>
            {completedCount > 0 && <p className="text-xs text-emerald-600 font-bold mt-4">{completedCount} tarefas já concluídas hoje!</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {pendingTasks.map(task => (
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
    );
  };

  const renderCalendarGrid = (viewType: "week" | "month") => {
    const start = viewType === "month" ? startOfWeek(startOfMonth(currentDate)) : startOfWeek(currentDate);
    const end = viewType === "month" ? endOfWeek(endOfMonth(currentDate)) : endOfWeek(currentDate);
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="px-4 pb-24">
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <button onClick={() => setCurrentDate(viewType === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-slate-800 capitalize">
            {viewType === "month" 
              ? format(currentDate, "MMMM yyyy", { locale: ptBR })
              : `Semana de ${format(start, "dd/MM")} a ${format(end, "dd/MM")}`
            }
          </h2>
          <button onClick={() => setCurrentDate(viewType === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4">
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} className="text-xs font-bold text-slate-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-3 gap-x-1">
            {days.map((day, i) => {
              const dateTasks = getTasksForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const pendingCount = dateTasks.filter(t => !isTaskCompletedOnDate(t.id!, day)).length;
              const hasTasks = dateTasks.length > 0;

              return (
                <button 
                  key={i} 
                  onClick={() => { if(hasTasks) setSelectedDatePopup(day); }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all
                    ${!isCurrentMonth && viewType === "month" ? "opacity-30" : "opacity-100"}
                    ${isToday ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"}
                  `}
                >
                  <span className={`text-sm font-semibold ${isToday ? "text-blue-700" : "text-slate-700"}`}>
                    {format(day, "d")}
                  </span>
                  
                  {/* Indicator dots */}
                  <div className="h-1.5 w-1.5 rounded-full mt-1 bg-transparent">
                    {hasTasks && (
                      <div className={`h-full w-full rounded-full ${pendingCount === 0 ? "bg-emerald-400" : "bg-rose-400"}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <NotificationManager />
      
      {/* Header */}
      <header className="bg-blue-600 px-6 pt-12 pb-8 shadow-sm mb-6 text-white rounded-b-[2.5rem]">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Lembra Eu</h1>
            <p className="text-blue-200 font-medium text-sm mt-1">Sua mente focada onde importa.</p>
          </div>
          <Link 
            href="/observer" 
            className="bg-white/10 text-white p-3 rounded-full text-sm font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
          >
            <User size={20} />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === "today" && renderAgendaTasks(new Date())}
      {activeTab === "week" && renderCalendarGrid("week")}
      {activeTab === "month" && renderCalendarGrid("month")}

      {/* Navigation Padding (to clear absolute bottom nav) */}
      <div className="h-24"></div>

      {/* Day Details Popup Modal */}
      {selectedDatePopup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 zoom-in-95">
            <div className="p-6 bg-white flex justify-between items-center shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-slate-800 capitalize">{format(selectedDatePopup, "EEEE", { locale: ptBR })}</h3>
                <p className="text-sm font-medium text-slate-500">{format(selectedDatePopup, "dd 'de' MMMM", { locale: ptBR })}</p>
              </div>
              <button onClick={() => setSelectedDatePopup(null)} className="p-2 bg-slate-100 text-slate-500 hover:text-slate-800 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {getTasksForDate(selectedDatePopup).length === 0 ? (
                <p className="text-center text-slate-500 my-8 font-medium">Nenhuma tarefa agendada.</p>
              ) : (
                <div className="space-y-4">
                  {getTasksForDate(selectedDatePopup).map(task => {
                    const completed = isTaskCompletedOnDate(task.id!, selectedDatePopup);
                    return (
                      <div key={task.id} className={`p-4 rounded-2xl border ${completed ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200'} shadow-sm`}>
                        <h4 className={`font-bold ${completed ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>{task.title}</h4>
                        {task.scheduleTime && (
                           <p className="text-sm mt-1 text-slate-500 font-medium flex items-center gap-1">⌚ {task.scheduleTime}</p>
                        )}
                        {!completed && isSameDay(selectedDatePopup, new Date()) && (
                          <button 
                            onClick={async () => { await handleCompleteTask(task.id!, true); }}
                            className="mt-3 text-sm bg-blue-100 text-blue-700 font-bold py-2 px-4 rounded-xl w-full"
                          >
                            Concluir
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => { setEditingTask(null); setShowForm(true); }}
        className="fixed bottom-[100px] right-6 w-[3.5rem] h-[3.5rem] bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <Plus size={32} />
      </button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe pt-2 px-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-30 flex justify-between">
        <button 
          onClick={() => { setActiveTab("today"); setCurrentDate(new Date()); }}
          className={`flex flex-col items-center flex-1 py-3 transition-colors ${activeTab === "today" ? "text-blue-600" : "text-slate-400"}`}
        >
          <CalendarIcon size={24} className={activeTab === "today" ? "fill-blue-50" : ""} />
          <span className="text-[10px] font-bold mt-1.5">Agenda</span>
        </button>
        <button 
          onClick={() => setActiveTab("week")}
          className={`flex flex-col items-center flex-1 py-3 transition-colors ${activeTab === "week" ? "text-blue-600" : "text-slate-400"}`}
        >
          <CalendarDays size={24} className={activeTab === "week" ? "fill-blue-50" : ""} />
          <span className="text-[10px] font-bold mt-1.5">Semana</span>
        </button>
        <button 
          onClick={() => setActiveTab("month")}
          className={`flex flex-col items-center flex-1 py-3 transition-colors ${activeTab === "month" ? "text-blue-600" : "text-slate-400"}`}
        >
          <CalendarRange size={24} className={activeTab === "month" ? "fill-blue-50" : ""} />
          <span className="text-[10px] font-bold mt-1.5">Mês</span>
        </button>
      </nav>

      {/* Form Dialog */}
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
