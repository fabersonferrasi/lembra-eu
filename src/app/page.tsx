"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Task, type TaskLog } from "@/lib/db";
import { TaskCard, type TaskCardTask } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { NotificationManager } from "@/components/NotificationManager";
import { SplashScreen } from "@/components/SplashScreen";
import { Confetti } from "@/components/Confetti";
import { Plus, CheckCircle2, Check, Calendar as CalendarIcon, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, X, User } from "lucide-react";
import Link from "next/link";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isSameMonth, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getTaskOccurrencesForDate } from "@/lib/reminderRules";
import { scheduleTaskNotifications, cancelTaskNotifications } from "@/lib/scheduling";

type ViewTab = "today" | "week" | "month";
type TaskOccurrenceCard = Omit<Task, "id"> & {
  id: number;
  occurrenceKey: string;
  occurrenceDate: string;
  occurrenceTime: string;
  occurrenceAt: Date;
};

type CompletionPayload = {
  taskId: number;
  isDoubleConfirmed: boolean;
  occurrenceKey: string;
  occurrenceDate: string;
  occurrenceTime: string;
};

function buildCompletionState(taskId: number, logs: TaskLog[]) {
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
    completedOccurrenceKeys,
    legacyCompletedDates,
  };
}

export default function HomePage() {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ViewTab>("today");
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return !sessionStorage.getItem("splashShown");
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  useEffect(() => {
    if (showSplash) {
      sessionStorage.setItem("splashShown", "true");
    }
  }, [showSplash]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCompleted, setShowCompleted] = useState(false);

  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const taskLogs = useLiveQuery(() => db.taskLogs.toArray(), []);

  const getOccurrencesForDate = (date: Date) => {
    if (!tasks) return [] as TaskOccurrenceCard[];

    return tasks
      .flatMap((task) => {
        const taskId = task.id;
        if (taskId == null) {
          return [] as TaskOccurrenceCard[];
        }

        return getTaskOccurrencesForDate(task, date).map((occurrence) => ({
          ...task,
          id: taskId,
          occurrenceKey: occurrence.occurrenceKey,
          occurrenceDate: occurrence.occurrenceDate,
          occurrenceTime: occurrence.scheduledTime,
          occurrenceAt: occurrence.mainFireAt,
        }));
      })
      .sort((left, right) => left.occurrenceAt.getTime() - right.occurrenceAt.getTime());
  };

  const isOccurrenceCompleted = (occurrence: TaskOccurrenceCard) => {
    if (!taskLogs) return false;

    const completionState = buildCompletionState(occurrence.id!, taskLogs);
    return (
      completionState.completedOccurrenceKeys.has(occurrence.occurrenceKey) ||
      completionState.legacyCompletedDates.has(occurrence.occurrenceDate)
    );
  };

  const getPendingOccurrencesForDate = (date: Date) => {
    return getOccurrencesForDate(date).filter((occurrence) => !isOccurrenceCompleted(occurrence));
  };

  // ---------------- Handlers ----------------
  const handleCreateOrUpdateTask = async (taskData: Partial<Task>) => {
    let savedId = taskData.id;
    if (savedId) {
      await db.tasks.update(savedId, taskData);
    } else {
      savedId = await db.tasks.add(taskData as Task) as number;
    }
    setShowForm(false);
    setEditingTask(undefined);
    
    const fullTask = { ...taskData, id: savedId } as Task;
    const completionState = buildCompletionState(savedId, taskLogs || []);
    scheduleTaskNotifications(fullTask, {
      completedOccurrenceKeys: [...completionState.completedOccurrenceKeys],
      legacyCompletedDates: [...completionState.legacyCompletedDates],
    }).catch(err => {
        console.error("Erro ao agendar notificações:", err);
    });
  };

  const handleEditTask = (task: TaskCardTask) => {
    setEditingTask({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      earlyReminderMinutes: task.earlyReminderMinutes,
      startDate: task.startDate,
      scheduleType: task.scheduleType as Task["scheduleType"],
      scheduleTime: task.scheduleTime,
      daysOfWeek: task.daysOfWeek,
      dayOfMonth: task.dayOfMonth,
      customSchedules: task.customSchedules,
      createdAt: task.createdAt,
    });
    setShowForm(true);
    setSelectedDate(null);
  };

  const handleDeleteTask = async (taskId: number) => {
    // CRITICAL FIX: Delete from DB FIRST, then cancel notifications in background.
    // Previous version awaited cancelTaskNotifications which could hang/fail on Android
    // and block the actual database deletion.
    try {
      // 1. Delete task logs first (foreign key cleanup)
      const logsToDel = await db.taskLogs.where({ taskId }).toArray();
      if (logsToDel.length > 0) {
        await db.taskLogs.bulkDelete(logsToDel.map(l => l.id!));
      }
      
      // 2. Delete the task itself
      await db.tasks.delete(taskId);
      
      console.log(`[Delete] Task ${taskId} deleted from DB successfully`);
      
      // 3. Cancel notifications in background (non-blocking, fire-and-forget)
      cancelTaskNotifications(taskId).catch(err => {
        console.warn("[Delete] Background notification cancel failed (non-critical):", err);
      });
    } catch (e) {
      console.error("[Delete] Failed to delete task:", e);
      alert("Erro ao excluir o lembrete. Tente novamente.");
    }
  };

  const handleCompleteTask = async ({
    taskId,
    isDoubleConfirmed,
    occurrenceKey,
    occurrenceDate,
    occurrenceTime,
  }: CompletionPayload) => {
    await db.taskLogs.add({
      taskId,
      completedAt: new Date(),
      isDoubleConfirmed,
      occurrenceKey,
      occurrenceDate,
      occurrenceTime,
    });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
    
    const task = await db.tasks.get(taskId);
    if (task) {
      const refreshedLogs = await db.taskLogs.where({ taskId }).toArray();
      const completionState = buildCompletionState(taskId, refreshedLogs);
      scheduleTaskNotifications(task, {
        completedOccurrenceKeys: [...completionState.completedOccurrenceKeys],
        legacyCompletedDates: [...completionState.legacyCompletedDates],
      }).catch(err => {
        console.warn("Erro ao reagendar notificações:", err);
      });
    }
  };

  // ---------------- TODAY VIEW ----------------
  const renderTodayView = () => {
    const today = new Date();
    const pendingTasks = getPendingOccurrencesForDate(today);
    const allForDate = getOccurrencesForDate(today);
    const completedTasks = allForDate.filter((occurrence) => isOccurrenceCompleted(occurrence));

    return (
      <div className="px-6 pb-24">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>Para Hoje</span>
          <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-sm font-bold">
            {pendingTasks.length} pendentes
          </span>
        </h2>

        {tasks === undefined ? (
           <div className="flex justify-center p-8"><div className="w-8 h-8 rounded-full border-4 border-fuchsia-200 border-t-fuchsia-600 animate-spin"></div></div>
        ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-10 text-center shadow-xl shadow-fuchsia-900/5 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-fuchsia-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 group-hover:opacity-40 transition-all duration-700"></div>
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 group-hover:opacity-40 transition-all duration-700"></div>
            <div className="relative z-10 w-24 h-24 bg-gradient-to-tr from-emerald-100 to-teal-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-200/50">
              <CheckCircle2 size={48} className="text-emerald-500 drop-shadow-sm" />
            </div>
            <h3 className="relative z-10 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 mb-2 tracking-tight">Tudo limpo!</h3>
            <p className="relative z-10 text-slate-600 font-medium text-base">Nenhuma pendência encontrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map(task => (
              <TaskCard key={task.occurrenceKey} task={task} onComplete={handleCompleteTask} onEdit={handleEditTask} onDelete={handleDeleteTask} />
            ))}
            {completedTasks.length > 0 && (
              <div className="mt-8 pt-4 border-t border-slate-200/60">
                <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors mb-4 w-full">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Concluídos de Hoje ({completedTasks.length})
                  <span className="text-[10px] ml-auto bg-slate-100 px-2 py-0.5 rounded-full">{showCompleted ? 'Ocultar' : 'Ver'}</span>
                </button>
                {showCompleted && (
                  <div className="space-y-2 opacity-60">
                    {completedTasks.map(task => (
                      <div key={task.occurrenceKey} className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-emerald-900 line-through opacity-70">{task.title}</h4>
                          {(task.occurrenceTime || task.scheduleTime) && <p className="text-[10px] text-emerald-700/60 font-medium">{task.occurrenceTime || task.scheduleTime}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ---------------- WEEK VIEW (Agenda with clickable days) ----------------
  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { locale: ptBR });
    const end = endOfWeek(currentDate, { locale: ptBR });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="px-5 pb-24">
        <div className="flex justify-between items-center mb-5 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-white/60">
          <button onClick={() => setCurrentDate(subWeeks(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-90">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="text-base font-black text-slate-800">
              {format(start, "dd/MM")} — {format(end, "dd/MM")}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Agenda Semanal</p>
          </div>
          <button onClick={() => setCurrentDate(addWeeks(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-90">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="space-y-2">
          {days.map(day => {
            const isToday = isSameDay(day, new Date());
            const dayTasks = getOccurrencesForDate(day);
            const pendingCount = dayTasks.filter((occurrence) => !isOccurrenceCompleted(occurrence)).length;
            const completedCount = dayTasks.filter((occurrence) => isOccurrenceCompleted(occurrence)).length;
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(isSelected ? null : day)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 border text-left ${
                  isSelected 
                    ? 'bg-violet-50 border-violet-300 shadow-md scale-[1.02]'
                    : isToday 
                      ? 'bg-white/90 border-violet-200 shadow-sm' 
                      : dayTasks.length > 0 
                        ? 'bg-white/70 border-slate-200 hover:bg-white/90 active:scale-[0.98]'
                        : 'bg-white/40 border-slate-100 opacity-50'
                }`}
              >
                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl font-black text-lg border ${
                  isToday 
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white border-violet-400 shadow-md' 
                    : isSelected
                      ? 'bg-violet-100 text-violet-700 border-violet-300'
                      : pendingCount === 0 && completedCount > 0
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  {format(day, "d")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black capitalize ${isToday ? 'text-violet-700' : isSelected ? 'text-violet-600' : 'text-slate-700'}`}>
                    {isToday ? "Hoje" : format(day, "EEEE", { locale: ptBR })}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    {format(day, "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {pendingCount > 0 && (
                    <span className="bg-rose-100 text-rose-600 py-0.5 px-2 rounded-full text-[9px] font-black">
                      {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {completedCount > 0 && (
                    <span className="bg-emerald-100 text-emerald-600 py-0.5 px-2 rounded-full text-[9px] font-black">
                      {completedCount} feito{completedCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {dayTasks.length === 0 && (
                    <span className="text-[9px] text-slate-300 font-medium">Livre</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ---------------- MONTH VIEW (Calendar Grid) ----------------
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { locale: ptBR });
    const monthEnd = endOfMonth(currentDate);
    const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="px-4 pb-24">
        <div className="flex justify-between items-center mb-4 bg-white/80 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-white/60">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-90">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="text-base font-black text-slate-800 capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
          </div>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-all active:scale-90">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm border border-white/60 p-3">
          <div className="grid grid-cols-7 mb-2">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-black text-slate-400 py-1.5 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((day, i) => {
              const dateTasks = getOccurrencesForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const pendingCount = dateTasks.filter((occurrence) => !isOccurrenceCompleted(occurrence)).length;
              const completedCount = dateTasks.filter((occurrence) => isOccurrenceCompleted(occurrence)).length;
              const hasTasks = dateTasks.length > 0;
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button 
                  key={i} 
                  onClick={() => { if (hasTasks) setSelectedDate(isSelected ? null : day); }}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 min-h-[48px] ${
                    !isCurrentMonth ? "opacity-20" : ""
                  } ${
                    isSelected ? "bg-violet-100 border border-violet-300 scale-105 shadow-sm"
                    : isToday ? "bg-violet-50 border border-violet-200" 
                    : hasTasks ? "hover:bg-slate-50 active:scale-95" : ""
                  }`}
                >
                  <span className={`text-sm font-bold leading-none ${
                    isSelected ? "text-violet-700" : isToday ? "text-violet-600 font-black" : "text-slate-700"
                  }`}>
                    {format(day, "d")}
                  </span>
                  <div className="flex gap-0.5 mt-1 h-1.5">
                    {pendingCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                    {completedCount > 0 && pendingCount === 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ---------------- DAY DETAIL POPUP ----------------
  const renderDayDetailPopup = () => {
    if (!selectedDate) return null;
    
    const allForDate = getOccurrencesForDate(selectedDate);
    const pendingTasks = getPendingOccurrencesForDate(selectedDate);
    const completedTasks = allForDate.filter((occurrence) => isOccurrenceCompleted(occurrence));
    const isToday = isSameDay(selectedDate, new Date());

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center" onClick={() => setSelectedDate(null)}>
        <div 
          className="bg-white border border-white/50 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 bg-gradient-to-r from-violet-50 to-fuchsia-50 flex justify-between items-center shadow-sm border-b border-violet-100/50">
            <div>
              <h3 className="text-lg font-black text-slate-800 capitalize">
                {isToday ? "Hoje" : format(selectedDate, "EEEE", { locale: ptBR })}
              </h3>
              <p className="text-sm font-medium text-slate-500">{format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            </div>
            <div className="flex items-center gap-2">
              {pendingTasks.length > 0 && (
                <span className="bg-rose-100 text-rose-600 py-0.5 px-2 rounded-full text-[10px] font-black">{pendingTasks.length}</span>
              )}
              <button onClick={() => setSelectedDate(null)} className="p-2 bg-slate-100 text-slate-500 hover:text-slate-800 rounded-full active:scale-90 transition-all">
                <X size={18} />
              </button>
            </div>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1">
            {allForDate.length === 0 ? (
              <p className="text-center text-slate-400 my-8 font-medium">Nenhuma tarefa agendada.</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map(task => (
                  <TaskCard key={task.occurrenceKey} task={task} onComplete={handleCompleteTask} onEdit={handleEditTask} onDelete={handleDeleteTask} />
                ))}
                {completedTasks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" /> Concluídos ({completedTasks.length})
                    </p>
                    <div className="space-y-1.5 opacity-50">
                      {completedTasks.map(task => (
                        <div key={task.occurrenceKey} className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-2.5 flex items-center gap-2.5">
                          <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-emerald-900 line-through opacity-70">{task.title}</h4>
                            {(task.occurrenceTime || task.scheduleTime) && <p className="text-[9px] text-emerald-700/60 font-medium">{task.occurrenceTime || task.scheduleTime}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-transparent relative selection:bg-fuchsia-500/30 font-sans">
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      {showConfetti && <Confetti />}
      <NotificationManager />
      
      <header className="relative px-6 pt-16 pb-12 mb-8 overflow-hidden rounded-b-[3rem] shadow-2xl shadow-violet-900/20">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-600 to-orange-500 animate-gradient-xy"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-orange-400/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        <div className="flex justify-between items-center relative z-10">
          <div className="animate-in slide-in-from-left-4 duration-700">
            <h1 className="text-4xl font-black tracking-tighter text-white drop-shadow-sm">
              Lembra <span className="text-orange-200">Eu</span>
            </h1>
            <p className="text-fuchsia-100 font-semibold text-base mt-1 drop-shadow-sm opacity-90">Sua mente focada e em paz.</p>
          </div>
          <Link href="/observer" className="group relative bg-white/10 hover:bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg">
            <User size={24} className="text-white group-hover:rotate-12 transition-transform" />
          </Link>
        </div>
      </header>

      <div className="px-6 mb-8 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
        <div className="flex p-1.5 bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm">
          {(["today", "week", "month"] as ViewTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedDate(null); if(tab === 'today') setCurrentDate(new Date()); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${
                activeTab === tab 
                  ? "bg-white text-violet-700 shadow-md" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/30"
              }`}
            >
              {tab === "today" ? "Hoje" : tab === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 animate-in fade-in duration-1000 delay-300">
        {activeTab === "today" && renderTodayView()}
        {activeTab === "week" && renderWeekView()}
        {activeTab === "month" && renderMonthView()}
      </div>

      <div className="h-24"></div>

      {renderDayDetailPopup()}

      <button
        onClick={() => { setEditingTask(undefined); setShowForm(true); }}
        className="fixed bottom-[110px] right-6 w-[3.5rem] h-[3.5rem] bg-gradient-to-tr from-fuchsia-600 to-orange-500 text-white rounded-[1.25rem] shadow-xl shadow-fuchsia-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
      >
        <Plus size={32} className="relative z-10" />
      </button>

      <div className="fixed bottom-6 left-6 right-6 z-30 pointer-events-none">
        <nav className="bg-white/80 backdrop-blur-2xl border border-white/60 pb-safe pt-1 px-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] rounded-3xl flex justify-between items-center pointer-events-auto">
          <button onClick={() => { setActiveTab("today"); setSelectedDate(null); setCurrentDate(new Date()); }} className={`flex flex-col items-center flex-1 py-3 transition-all ${activeTab === "today" ? "text-fuchsia-600 scale-110" : "text-slate-400"}`}>
            <CalendarIcon size={22} />
            <span className="text-[10px] font-bold mt-1">Agenda</span>
          </button>
          <button onClick={() => { setActiveTab("week"); setSelectedDate(null); }} className={`flex flex-col items-center flex-1 py-3 transition-all ${activeTab === "week" ? "text-fuchsia-600 scale-110" : "text-slate-400"}`}>
            <CalendarDays size={22} />
            <span className="text-[10px] font-bold mt-1">Semana</span>
          </button>
          <button onClick={() => { setActiveTab("month"); setSelectedDate(null); }} className={`flex flex-col items-center flex-1 py-3 transition-all ${activeTab === "month" ? "text-fuchsia-600 scale-110" : "text-slate-400"}`}>
            <CalendarRange size={22} />
            <span className="text-[10px] font-bold mt-1">Mês</span>
          </button>
        </nav>
      </div>

      {showForm && (
        <TaskForm initialData={editingTask} onSubmit={handleCreateOrUpdateTask} onCancel={() => { setShowForm(false); setEditingTask(undefined); }} />
      )}
    </main>
  );
}
