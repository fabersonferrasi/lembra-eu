"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { CheckCircle2, Clock, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ObserverPage() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const taskLogs = useLiveQuery(() => db.taskLogs.toArray(), []);

  const today = new Date().setHours(0, 0, 0, 0);

  // Map tasks with their completion status for today
  const tasksStatus = tasks?.map(task => {
    const logToday = taskLogs?.find(log => {
      const logDate = new Date(log.completedAt).setHours(0, 0, 0, 0);
      return log.taskId === task.id && logDate === today;
    });

    return {
      ...task,
      isCompleted: !!logToday,
      isDoubleConfirmed: logToday?.isDoubleConfirmed || false,
      completedAt: logToday?.completedAt
    };
  });

  const completedCount = tasksStatus?.filter(t => t.isCompleted).length || 0;
  const totalCount = tasksStatus?.length || 0;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-slate-800 px-6 pt-12 pb-8 rounded-b-[2.5rem] shadow-md mb-6 text-white relative">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/" className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Modo Observador
            </h1>
            <p className="text-slate-300 font-medium text-sm">Acompanhamento das tarefas diárias</p>
          </div>
        </div>

        <div className="mt-8 bg-white/10 rounded-2xl p-5 border border-white/20">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-semibold text-slate-300">Progresso de Hoje</span>
            <span className="text-2xl font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-emerald-400 h-3 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-slate-400 mt-3 text-right">
            {completedCount} de {totalCount} tarefas concluídas
          </p>
        </div>
      </header>

      <div className="px-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          Tarefas Monitoradas
        </h2>

        {tasksStatus === undefined ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"></div>
          </div>
        ) : tasksStatus.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
            <p className="text-slate-500 font-medium tracking-wide">Nenhuma tarefa cadastrada para acompanhamento ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasksStatus.map((task) => (
              <div 
                key={task.id} 
                className={`flex items-center justify-between p-4 rounded-2xl border ${task.isCompleted ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'} shadow-sm transition-all hover:shadow-md`}
              >
                <div className="flex-1">
                  <h3 className={`font-bold ${task.isCompleted ? 'text-emerald-900 line-through decoration-emerald-300/50' : 'text-slate-800'}`}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs font-semibold">
                    {task.isCompleted ? (
                      <span className="text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        Feito às {format(new Date(task.completedAt!), "HH:mm")}
                        {task.isDoubleConfirmed && " (Confirmado)"}
                      </span>
                    ) : (
                      <span className="text-rose-500 flex items-center gap-1.5">
                        <XCircle size={14} /> Pendente
                      </span>
                    )}
                    
                    {task.scheduleTime && !task.isCompleted && (
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Clock size={14} /> {task.scheduleTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
