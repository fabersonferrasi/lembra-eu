"use client";

import { useState } from "react";
import {
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  Clock,
  HeartPulse,
  Plus,
  RotateCcw,
  Trash2,
  User,
  X,
} from "lucide-react";

import type { Task } from "@/lib/db";

interface TaskFormProps {
  initialData?: Partial<Task>;
  onSubmit: (task: Partial<Task>) => Promise<void> | void;
  onCancel: () => void;
}

type TaskCategory = Task["category"];

const WEEK_DAYS = [
  { id: 0, label: "D" },
  { id: 1, label: "S" },
  { id: 2, label: "T" },
  { id: 3, label: "Q" },
  { id: 4, label: "Q" },
  { id: 5, label: "S" },
  { id: 6, label: "S" },
];

export function TaskForm({ initialData, onSubmit, onCancel }: TaskFormProps) {
  const isEditing = !!initialData;
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [category, setCategory] = useState<TaskCategory>(initialData?.category || "routine");
  const [earlyReminderMinutes, setEarlyReminderMinutes] = useState<number>(
    initialData?.earlyReminderMinutes || 0,
  );
  const [startDate, setStartDate] = useState(
    initialData?.startDate
      ? new Date(initialData.startDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  );
  const [scheduleType, setScheduleType] = useState<Task["scheduleType"]>(
    initialData?.scheduleType || "daily",
  );
  const [scheduleTime, setScheduleTime] = useState(initialData?.scheduleTime || "");
  const [customSchedules, setCustomSchedules] = useState<{ days: number[]; time: string }[]>(
    initialData?.customSchedules || [{ days: [], time: "" }],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { id: "personal", label: "Pessoal", icon: User, color: "text-blue-500", bg: "bg-blue-50" },
    { id: "work", label: "Trabalho", icon: Briefcase, color: "text-amber-500", bg: "bg-amber-50" },
    { id: "health", label: "Saude", icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-50" },
    { id: "routine", label: "Rotina", icon: RotateCcw, color: "text-emerald-500", bg: "bg-emerald-50" },
    { id: "study", label: "Estudo", icon: BookOpen, color: "text-violet-500", bg: "bg-violet-50" },
  ] as const;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Por favor, preencha o titulo do lembrete.");
      return;
    }

    if (scheduleType === "custom") {
      const validSchedules = customSchedules.filter((entry) => entry.days.length > 0 && entry.time);
      if (validSchedules.length === 0) {
        alert("No modo personalizado, escolha ao menos um dia e um horario.");
        return;
      }
    } else if (!scheduleTime) {
      alert("Informe o horario do lembrete.");
      return;
    }

    setIsSubmitting(true);

    try {
      const [year, month, day] = startDate.split("-").map(Number);
      const localStartDate = new Date(year, month - 1, day);

      await onSubmit({
        ...initialData,
        title,
        description,
        category,
        earlyReminderMinutes,
        startDate: localStartDate,
        scheduleType,
        scheduleTime: scheduleType === "custom" ? undefined : scheduleTime,
        daysOfWeek: scheduleType === "weekly" ? [localStartDate.getDay()] : undefined,
        dayOfMonth: scheduleType === "monthly" ? localStartDate.getDate() : undefined,
        customSchedules:
          scheduleType === "custom"
            ? customSchedules.filter((entry) => entry.days.length > 0 && entry.time)
            : undefined,
        createdAt: initialData?.createdAt || new Date(),
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar o lembrete. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  const toggleDay = (scheduleIndex: number, dayId: number) => {
    setCustomSchedules((prev) => {
      const next = [...prev];
      const selectedDays = next[scheduleIndex].days;
      next[scheduleIndex] = {
        ...next[scheduleIndex],
        days: selectedDays.includes(dayId)
          ? selectedDays.filter((day) => day !== dayId)
          : [...selectedDays, dayId],
      };
      return next;
    });
  };

  const updateTime = (scheduleIndex: number, time: string) => {
    setCustomSchedules((prev) => {
      const next = [...prev];
      next[scheduleIndex] = { ...next[scheduleIndex], time };
      return next;
    });
  };

  const addCustomSchedule = () => {
    setCustomSchedules((prev) => [...prev, { days: [], time: "" }]);
  };

  const removeCustomSchedule = (index: number) => {
    if (customSchedules.length <= 1) {
      return;
    }

    setCustomSchedules((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-3xl border border-white/50 rounded-3xl shadow-2xl shadow-violet-900/20 w-full max-w-md max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 bg-white/50 border-b border-indigo-50 sticky top-0 z-10 backdrop-blur-sm">
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">
            {isEditing ? "Editar Lembrete" : "Novo Lembrete"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-rose-500 bg-white shadow-sm p-2 rounded-full transition-all hover:scale-105 active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                O que voce precisa fazer?
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Tomar remedio"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Detalhes adicionais (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Depois do cafe da manha..."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-20"
              />
            </div>

            <div>
              <label className="block text-sm font-black text-slate-800 mb-3">Classificacao</label>
              <div className="grid grid-cols-5 gap-2">
                {categories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all border-2 ${
                      category === item.id
                        ? `border-indigo-500 ${item.bg} scale-105 shadow-md`
                        : "border-transparent bg-slate-50 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <item.icon
                      size={20}
                      className={category === item.id ? item.color : "text-slate-400"}
                    />
                    <span className="text-[10px] font-bold mt-1 text-slate-600">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar size={14} className="text-indigo-500" /> Comecar em
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Clock size={14} className="text-indigo-500" /> Aviso previo
                </label>
                <select
                  value={earlyReminderMinutes}
                  onChange={(e) => setEarlyReminderMinutes(Number(e.target.value))}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold text-slate-700 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:1.25rem] bg-no-repeat bg-[right_0.5rem_center]"
                >
                  <option value={0}>No horario</option>
                  <option value={5}>5 min antes</option>
                  <option value={10}>10 min antes</option>
                  <option value={15}>15 min antes</option>
                  <option value={30}>30 min antes</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Repeticao</label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as Task["scheduleType"])}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
              >
                <option value="daily">Todos os dias</option>
                <option value="weekly">Toda semana (mesmo dia do inicio)</option>
                <option value="monthly">Todo mes (mesmo dia do inicio)</option>
                <option value="custom">Dias especificos da semana</option>
                <option value="once">Apenas uma vez</option>
              </select>
            </div>

            {scheduleType !== "custom" ? (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Horario</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            ) : null}

            {scheduleType === "custom" ? (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-4">
                <p className="text-sm font-semibold text-blue-800">Rotinas personalizadas</p>
                {customSchedules.map((schedule, index) => (
                  <div
                    key={`${index}-${schedule.time}`}
                    className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm relative"
                  >
                    {customSchedules.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeCustomSchedule(index)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}

                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                      Dias da semana
                    </label>
                    <div className="flex justify-between mb-3">
                      {WEEK_DAYS.map((day) => {
                        const isSelected = schedule.days.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(index, day.id)}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-sm scale-110"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>

                    <label className="block text-xs font-semibold text-slate-600 mb-1">Horario</label>
                    <input
                      type="time"
                      value={schedule.time}
                      onChange={(e) => updateTime(index, e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addCustomSchedule}
                  className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700"
                >
                  <Plus size={16} /> Adicionar outro horario
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                isSubmitting
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 hover:opacity-90 shadow-fuchsia-500/30"
              }`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
              ) : isEditing ? (
                <Check size={20} />
              ) : (
                <Plus size={20} />
              )}
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alteracoes" : "Criar lembrete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
