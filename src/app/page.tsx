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
           <div className="flex justify-center p-8"><div className="w-8 h-8 rounded-full border-4 border-fuchsia-200 border-t-fuchsia-600 animate-spin"></div></div>
        ) : pendingTasks.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-10 text-center shadow-xl shadow-fuchsia-900/5 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-fuchsia-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 group-hover:opacity-40 transition-all duration-700"></div>
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 group-hover:opacity-40 transition-all duration-700"></div>
            
            <div className="relative z-10 w-24 h-24 bg-gradient-to-tr from-emerald-100 to-teal-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200/50">
              <CheckCircle2 size={48} className="text-emerald-500 drop-shadow-sm" />
            </div>
            <h3 className="relative z-10 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 mb-2 tracking-tight">Tudo limpo!</h3>
            <p className="relative z-10 text-slate-600 font-medium text-base">Sua mente está livre de pendências hoje.</p>
            {completedCount > 0 && <div className="relative z-10 mt-6 inline-flex border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold px-4 py-2 rounded-xl text-xs">{completedCount} tarefas já concluídas hoje!</div>}
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
    <main className="min-h-screen bg-transparent relative selection:bg-fuchsia-500/30 font-sans">
      <NotificationManager />
      
      {/* Premium Header with Animated Aura */}
      <header className="relative px-6 pt-16 pb-12 mb-8 overflow-hidden rounded-b-[3rem] shadow-2xl shadow-violet-900/20">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-600 to-orange-500 animate-gradient-xy"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        
        {/* Glowing Orbs */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-orange-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>

        <div className="flex justify-between items-center relative z-10">
          <div className="animate-in slide-in-from-left-4 duration-700">
            <h1 className="text-4xl font-black tracking-tighter text-white drop-shadow-sm">
              Lembra <span className="text-orange-200">Eu</span>
            </h1>
            <p className="text-fuchsia-100 font-semibold text-base mt-1 drop-shadow-sm opacity-90">Sua mente focada e em paz.</p>
          </div>
          <Link 
            href="/observer" 
            className="group relative bg-white/10 hover:bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg"
          >
            <User size={24} className="text-white group-hover:rotate-12 transition-transform" />
          </Link>
        </div>
      </header>

      {/* View Tabs - Pill Style */}
      <div className="px-6 mb-8 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
        <div className="flex p-1.5 bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm">
          {(["today", "week", "month"] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if(tab === 'today') setCurrentDate(new Date()); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${
                activeTab === tab 
                  ? "bg-white text-violet-700 shadow-md scale-100" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/30"
              }`}
            >
              {tab === "today" ? "Hoje" : tab === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area with Glass Container */}
      <div className="relative z-10 animate-in fade-in duration-1000 delay-300">
        {activeTab === "today" && renderAgendaTasks(new Date())}
        {activeTab === "week" && renderCalendarGrid("week")}
        {activeTab === "month" && renderCalendarGrid("month")}
      </div>

      {/* Navigation Padding (to clear absolute bottom nav) */}
      <div className="h-24"></div>

      {/* Day Details Popup Modal */}
      {selectedDatePopup && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-3xl border border-white/50 rounded-[2.5rem] shadow-2xl shadow-violet-900/20 w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 zoom-in-95">
            <div className="p-6 bg-white/50 flex justify-between items-center shadow-sm">
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
                            className="mt-3 text-sm bg-gradient-to-r from-violet-100 to-fuchsia-100 text-fuchsia-800 hover:from-violet-200 hover:to-fuchsia-200 transition-colors font-bold py-2.5 px-4 rounded-xl w-full flex items-center justify-center gap-1 shadow-sm"
                          >
                            <CheckCircle2 size={16} /> Concluir
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
        className="fixed bottom-[110px] right-6 w-[3.5rem] h-[3.5rem] bg-gradient-to-tr from-fuchsia-600 to-orange-500 text-white rounded-[1.25rem] shadow-xl shadow-fuchsia-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 before:absolute before:inset-0 before:bg-white/20 before:rounded-[1.25rem] before:opacity-0 hover:before:opacity-100"
      >
        <Plus size={32} className="relative z-10" />
      </button>

      {/* Bottom Navigation */}
      <div className="fixed bottom-6 left-6 right-6 z-30 pointer-events-none">
        <nav className="bg-white/80 backdrop-blur-2xl border border-white/60 pb-safe pt-1 px-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] rounded-3xl flex justify-between items-center pointer-events-auto">
          <button 
            onClick={() => { setActiveTab("today"); setCurrentDate(new Date()); }}
            className={`flex flex-col items-center flex-1 py-3 transition-all ${activeTab === "today" ? "text-fuchsia-600 scale-110" : "text-slate-400 hover:text-slate-600"}`}
          >
            <CalendarIcon size={22} className={activeTab === "today" ? "fill-fuchsia-50 drop-shadow-sm" : ""} />
            <span className="text-[10px] font-bold mt-1">Agenda</span>
          </button>
          <button 
            onClick={() => setActiveTab("week")}
            className={`flex flex-col items-center flex-1 py-3 transition-all ${activeTab === "week" ? "text-fuchsia-600 scale-110" : "text-slate-400 hover:text-slate-600"}`}
          >
            <CalendarDays size={22} className={activeTab === "week" ? "fill-fuchsia-50 drop-shadow-sm" : ""} />
            <span className="text-[10px] font-bold mt-1">Semana</span>
          </button>
          <button 
            onClick={() => setActiveTab("month")}
            className={`flex flex-col items-center flex-1 py-3 transition-all ${activeTab === "month" ? "text-fuchsia-600 scale-110" : "text-slate-400 hover:text-slate-600"}`}
          >
            <CalendarRange size={22} className={activeTab === "month" ? "fill-fuchsia-50 drop-shadow-sm" : ""} />
            <span className="text-[10px] font-bold mt-1">Mês</span>
          </button>
        </nav>
      </div>

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
