"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  Briefcase,
  Check,
  Circle,
  Clock,
  Edit2,
  HeartPulse,
  MoreVertical,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";

export interface TaskCardTask {
  id: number;
  title: string;
  description?: string;
  category?: "personal" | "work" | "health" | "routine" | "study";
  earlyReminderMinutes?: number;
  startDate?: Date;
  scheduleType: string;
  scheduleTime?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  occurrenceKey: string;
  occurrenceDate: string;
  occurrenceTime: string;
  customSchedules?: { days: number[]; time: string }[];
  createdAt?: Date;
}

interface TaskCardProps {
  task: TaskCardTask;
  onComplete: (payload: {
    taskId: number;
    isDoubleConfirmed: boolean;
    occurrenceKey: string;
    occurrenceDate: string;
    occurrenceTime: string;
  }) => Promise<void> | void;
  onEdit?: (task: TaskCardTask) => void;
  onDelete?: (taskId: number) => void;
}

export function TaskCard({ task, onComplete, onEdit, onDelete }: TaskCardProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleFirstInteraction = () => setShowConfirmation(true);
  const handleDoubleConfirm = () => {
    onComplete({
      taskId: task.id,
      isDoubleConfirmed: true,
      occurrenceKey: task.occurrenceKey,
      occurrenceDate: task.occurrenceDate,
      occurrenceTime: task.occurrenceTime,
    });
    setShowConfirmation(false);
  };
  const handleCancel = () => setShowConfirmation(false);

  const handleDeleteRequest = () => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete?.(task.id);
  };

  const handleEditRequest = () => {
    setShowMenu(false);
    onEdit?.(task);
  };

  const isRecurring = task.scheduleType !== "once";
  const displayTime = task.occurrenceTime || task.scheduleTime || task.customSchedules?.[0]?.time;

  const categoryConfig = {
    personal: {
      icon: User,
      color: "from-blue-500 to-indigo-500",
      bg: "bg-blue-50",
      text: "text-blue-600",
      label: "Pessoal",
    },
    work: {
      icon: Briefcase,
      color: "from-amber-500 to-orange-500",
      bg: "bg-amber-50",
      text: "text-amber-600",
      label: "Trabalho",
    },
    health: {
      icon: HeartPulse,
      color: "from-rose-500 to-pink-500",
      bg: "bg-rose-50",
      text: "text-rose-600",
      label: "Saude",
    },
    routine: {
      icon: RotateCcw,
      color: "from-emerald-500 to-teal-500",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      label: "Rotina",
    },
    study: {
      icon: BookOpen,
      color: "from-violet-500 to-fuchsia-500",
      bg: "bg-violet-50",
      text: "text-violet-600",
      label: "Estudo",
    },
  } as const;

  const config = categoryConfig[task.category as keyof typeof categoryConfig] || categoryConfig.routine;
  const CategoryIcon = config.icon;

  return (
    <>
      <div
        className={`bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border ${
          isHovered ? "border-indigo-400 shadow-md scale-[1.01]" : "border-slate-200"
        } transition-all duration-300 mb-2 relative group overflow-hidden flex items-center p-2`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setTimeout(() => setIsHovered(false), 1500)}
      >
        <div
          className={`absolute left-0 top-2 bottom-2 w-1.5 bg-gradient-to-b ${config.color} rounded-r-full transition-all duration-500 ${
            isHovered ? "opacity-100 scale-y-110" : "opacity-40"
          }`}
        />

        <button
          onClick={handleFirstInteraction}
          title="Marcar como feito"
          className={`ml-2 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
            isHovered
              ? "bg-emerald-50 border-emerald-400 text-emerald-500 scale-110"
              : "bg-slate-50 border-slate-100 text-slate-300"
          }`}
        >
          {isHovered ? <Check size={18} strokeWidth={3} /> : <Circle size={18} strokeWidth={2} />}
        </button>

        <div className="flex-1 min-w-0 ml-3 py-1">
          <h3
            className={`text-sm font-black tracking-tight transition-colors duration-300 ${
              isHovered ? "text-violet-900" : "text-slate-800"
            } truncate leading-tight`}
          >
            {task.title}
          </h3>

          {task.description ? (
            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 leading-tight font-medium opacity-80">
              {task.description}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <div className={`${config.bg} p-1 rounded-md`}>
              <CategoryIcon size={10} className={config.text} />
            </div>

            {displayTime ? (
              <span className="flex items-center gap-1 text-[9px] text-violet-700 font-black bg-violet-100/50 px-1.5 py-0.5 rounded-lg border border-violet-100/30">
                <Clock size={9} /> {displayTime}
              </span>
            ) : null}

            {task.earlyReminderMinutes ? (
              <span className="flex items-center gap-1 text-[8px] text-amber-700 font-black bg-amber-100/50 px-1.5 py-0.5 rounded-lg border border-amber-100/30">
                <BellRing size={8} /> -{task.earlyReminderMinutes}m
              </span>
            ) : null}

            {task.scheduleType ? (
              <span
                className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg border ${
                  isRecurring
                    ? "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100/50"
                    : "bg-slate-50 text-slate-400 border-slate-100"
                }`}
              >
                {task.scheduleType === "daily"
                  ? "Diario"
                  : task.scheduleType === "weekly"
                    ? "Semanal"
                    : task.scheduleType === "monthly"
                      ? "Mensal"
                      : "Unico"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative flex-shrink-0 ml-1 mr-1">
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="text-slate-300 hover:text-violet-600 p-2 rounded-xl hover:bg-violet-50 transition-all active:scale-90"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {showMenu ? (
        <div className="fixed inset-0 z-[150]" onClick={() => setShowMenu(false)}>
          <div className="absolute inset-0" />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-[160] animate-in fade-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 py-2 border-b border-slate-100 mb-1">
              <p className="text-xs font-black text-slate-800 truncate">{task.title}</p>
              <p className="text-[10px] text-slate-400 font-medium">
                {config.label} · {displayTime || "Sem horario"}
              </p>
            </div>
            <button
              onClick={handleEditRequest}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-3 transition-colors"
            >
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-violet-500">
                <Edit2 size={16} />
              </div>
              Editar detalhes
            </button>
            <button
              onClick={handleDeleteRequest}
              className="w-full text-left px-4 py-3 hover:bg-rose-50 active:bg-rose-100 text-xs font-bold text-rose-600 flex items-center gap-3 transition-colors"
            >
              <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center text-rose-500">
                <Trash2 size={16} />
              </div>
              {isRecurring ? "Excluir toda a serie" : "Excluir lembrete"}
            </button>
          </div>
        </div>
      ) : null}

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 relative z-[210] animate-in slide-in-from-bottom-8 zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                <AlertTriangle size={24} className="text-rose-500" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800">Excluir lembrete?</h4>
                <p className="text-xs text-slate-500 font-medium">{task.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {isRecurring
                ? "Este lembrete e recorrente. Deseja excluir toda a serie e os agendamentos futuros?"
                : "Tem certeza de que deseja excluir este lembrete?"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-bold py-3 px-4 rounded-xl transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black py-3 px-4 rounded-xl transition-all text-sm shadow-lg shadow-rose-500/30"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showConfirmation ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={handleCancel}
          />
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 relative z-[210] animate-in slide-in-from-bottom-12 duration-500">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full border-4 border-white flex items-center justify-center text-white shadow-xl">
                <Check size={48} strokeWidth={4} />
              </div>
            </div>

            <div className="pt-10 pb-2 text-center">
              <h4 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">
                Concluir lembrete
              </h4>
              <p className="text-slate-500 mb-8 text-base leading-relaxed font-medium">
                Voce confirma a conclusao desta ocorrencia? Os alertas desta instancia serao interrompidos.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDoubleConfirm}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-95 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-500/30 text-base"
                >
                  Confirmar conclusao
                </button>
                <button
                  onClick={handleCancel}
                  className="w-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-bold py-4 px-6 rounded-2xl transition-all text-sm"
                >
                  Ainda nao fiz
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
