"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type TaskLog } from "@/lib/db";
import { CheckCircle2, Clock, XCircle, ArrowLeft, TrendingUp, Zap, BarChart3, User, Briefcase, HeartPulse, RotateCcw, BookOpen } from "lucide-react";
import Link from "next/link";
import { format, isSameDay, subDays, startOfDay } from "date-fns";
import { getTaskOccurrencesForDate } from "@/lib/reminderRules";

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

      const completedAt = startOfDay(new Date(log.completedAt));
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

export default function ObserverPage() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const taskLogs = useLiveQuery(() => db.taskLogs.toArray(), []);

  const today = startOfDay(new Date()).getTime();

  const occurrencesToday =
    tasks?.flatMap((task) =>
      getTaskOccurrencesForDate(task, new Date()).map((occurrence) => {
        const completionState = buildCompletionState(task.id!, taskLogs || []);
        const matchedLog = taskLogs?.find((log) => {
          if (log.taskId !== task.id) {
            return false;
          }

          if (log.occurrenceKey) {
            return log.occurrenceKey === occurrence.occurrenceKey;
          }

          const logDate = startOfDay(new Date(log.completedAt)).getTime();
          return logDate === today;
        });

        return {
          ...task,
          occurrenceKey: occurrence.occurrenceKey,
          occurrenceTime: occurrence.scheduledTime,
          isCompleted:
            completionState.completedOccurrenceKeys.has(occurrence.occurrenceKey) ||
            completionState.legacyCompletedDates.has(occurrence.occurrenceDate),
          isDoubleConfirmed: matchedLog?.isDoubleConfirmed || false,
          completedAt: matchedLog?.completedAt,
        };
      }),
    ) || [];

  const completedToday = occurrencesToday.filter((task) => task.isCompleted).length || 0;
  const totalToday = occurrencesToday.length || 0;
  const progress = totalToday === 0 ? 0 : Math.round((completedToday / totalToday) * 100);

  // 2. Calculate Streak (Consecutive days with at least one completion)
  const getStreak = () => {
    if (!taskLogs || taskLogs.length === 0) return 0;
    let streak = 0;
    let checkDate = startOfDay(new Date());
    
    while (true) {
        const hasCompletion = taskLogs.some(log => isSameDay(new Date(log.completedAt), checkDate));
        if (hasCompletion) {
            streak++;
            checkDate = subDays(checkDate, 1);
        } else {
            // If it's today and no completion yet, don't break the streak from yesterday
            if (isSameDay(checkDate, new Date())) {
                checkDate = subDays(checkDate, 1);
                continue;
            }
            break;
        }
        if (streak > 365) break; // sanity check
    }
    return streak;
  };

  const streak = getStreak();

  // 3. Category Distribution
  const getCategoryStats = () => {
     if (!tasks) return [];
     const stats = {
         personal: 0, work: 0, health: 0, routine: 0, study: 0
     };
     tasks.forEach(t => {
         if (t.category && stats[t.category as keyof typeof stats] !== undefined) {
             stats[t.category as keyof typeof stats]++;
         }
     });
     return Object.entries(stats).map(([id, count]) => ({ id, count })).filter(s => s.count > 0);
  };

  const catStats = getCategoryStats();
  const categoryIcons = {
    personal: User, work: Briefcase, health: HeartPulse, routine: RotateCcw, study: BookOpen
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-24 font-sans selection:bg-indigo-500/20">
      {/* Premium Header/Aura */}
      <header className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 pt-12 pb-16 rounded-b-[3rem] shadow-2xl overflow-hidden text-white mb-8">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full animate-pulse"></div>
        
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <Link href="/" className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl backdrop-blur-md border border-white/10 transition-all hover:scale-105 active:scale-95">
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Diamond <span className="text-indigo-400">Status</span></h1>
            <p className="text-slate-400 font-bold text-sm tracking-tight opacity-80 uppercase">Modo Observador & Insights</p>
          </div>
        </div>

        {/* Hero Indicators */}
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400"><TrendingUp size={16} /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taxa de Sucesso</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">{progress}</span>
              <span className="text-lg font-bold text-slate-500">%</span>
            </div>
            <div className="w-full bg-slate-800/50 rounded-full h-1.5 mt-4 overflow-hidden">
               <div className="bg-gradient-to-r from-emerald-400 to-teal-400 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400"><Zap size={16} /></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sequência Atual</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black">{streak}</span>
              <span className="text-sm font-bold text-slate-500">DIAS</span>
            </div>
            <p className="text-[10px] font-bold text-amber-400/60 mt-4 tracking-tight flex items-center gap-1">
               {streak > 0 ? "Fogo constante! Mantendo o foco." : "Inicie uma sequência hoje!"}
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Category Breakdown */}
        {catStats.length > 0 && (
          <section>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <BarChart3 size={14} /> Distribuição por Categoria
            </h2>
            <div className="flex flex-wrap gap-2">
              {catStats.map(stat => {
                const Icon = categoryIcons[stat.id as keyof typeof categoryIcons];
                return (
                  <div key={stat.id} className="bg-white border border-slate-200 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm">
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-400"><Icon size={16} /></div>
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{stat.id}</div>
                        <div className="text-sm font-black text-slate-800">{stat.count} {stat.count === 1 ? 'Lembrete' : 'Lembretes'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Task List */}
        <section>
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock size={14} /> Registro de Hoje
             </h2>
             <span className="text-[10px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                {completedToday}/{totalToday}
             </span>
          </div>

          {tasks === undefined || taskLogs === undefined ? (
            <div className="flex justify-center p-12 text-indigo-400"><Clock size={48} className="animate-pulse" /></div>
          ) : occurrencesToday.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-10 text-center border border-slate-100 shadow-sm">
              <p className="text-slate-400 font-bold text-sm">Nenhum lembrete monitorado no sistema.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {occurrencesToday.map((task) => {
                const Icon = categoryIcons[task.category as keyof typeof categoryIcons] || Clock;
                return (
                  <div key={task.occurrenceKey} className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${task.isCompleted ? 'bg-emerald-50/50 border-emerald-100 shadow-sm' : 'bg-white border-slate-200 shadow-sm'} group`}>
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:scale-110 transition-transform">
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 ml-4 min-w-0">
                      <h3 className={`text-sm font-black truncate ${task.isCompleted ? 'text-emerald-900 line-through opacity-50' : 'text-slate-800'}`}>
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-0.5">
                        {task.isCompleted ? (
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter flex items-center gap-1">
                            <CheckCircle2 size={10} /> Concluído às {format(new Date(task.completedAt!), "HH:mm")}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-tighter flex items-center gap-1">
                            <XCircle size={10} /> Pendência Ativa
                          </span>
                        )}
                        {(task.occurrenceTime || task.scheduleTime) && !task.isCompleted && (
                           <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                              <Clock size={10} /> {task.occurrenceTime || task.scheduleTime}
                           </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
