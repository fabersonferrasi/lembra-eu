"use client";

import { useState } from "react";
import { Plus, Check, X, Trash2 } from "lucide-react";

interface TaskFormProps {
  initialData?: any;
  onSubmit: (task: any) => Promise<void> | void;
  onCancel: () => void;
}

const WEEK_DAYS = [
  { id: 0, label: "D" },
  { id: 1, label: "S" },
  { id: 2, label: "T" },
  { id: 3, label: "Q" },
  { id: 4, label: "Q" },
  { id: 5, label: "S" },
  { id: 6, label: "S" }
];

export function TaskForm({ initialData, onSubmit, onCancel }: TaskFormProps) {
  const isEditing = !!initialData;
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [scheduleType, setScheduleType] = useState(initialData?.scheduleType || "daily");
  const [scheduleTime, setScheduleTime] = useState(initialData?.scheduleTime || "");
  const [customSchedules, setCustomSchedules] = useState<{days: number[], time: string}[]>(
    initialData?.customSchedules || [{ days: [], time: "" }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Por favor, preencha o campo 'O que você precisa fazer?'.");
      return;
    }
    if (scheduleType === "custom") {
      // Validate custom schedules
      const validSchedules = customSchedules.filter(c => c.days.length > 0 && c.time);
      if (validSchedules.length === 0) {
        alert("Para o agendamento personalizado, selecione ao menos um dia da semana e um horário específico.");
        return;
      }
    } else if (!scheduleTime && scheduleType !== "once") {
      alert("Informe um horário pre-agendado para a tarefa.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...initialData,
        title,
        description,
        scheduleType,
        scheduleTime,
        customSchedules: scheduleType === "custom" ? customSchedules.filter(c => c.days.length > 0 && c.time) : undefined,
        createdAt: initialData?.createdAt || new Date(),
      });
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar! Tente novamente.");
      setIsSubmitting(false);
    }
  };

  const toggleDay = (scheduleIndex: number, dayId: number) => {
    setCustomSchedules(prev => {
      const newSchedules = [...prev];
      const days = newSchedules[scheduleIndex].days;
      const newDays = days.includes(dayId) ? days.filter(d => d !== dayId) : [...days, dayId];
      // Force object creation for React state update
      newSchedules[scheduleIndex] = { ...newSchedules[scheduleIndex], days: newDays };
      return newSchedules;
    });
  };

  const updateTime = (scheduleIndex: number, time: string) => {
    setCustomSchedules(prev => {
      const newSchedules = [...prev];
      newSchedules[scheduleIndex] = { ...newSchedules[scheduleIndex], time };
      return newSchedules;
    });
  };

  const addCustomSchedule = () => {
    setCustomSchedules(prev => [...prev, { days: [], time: "" }]);
  };

  const removeCustomSchedule = (index: number) => {
    if (customSchedules.length <= 1) return;
    setCustomSchedules(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-800">{isEditing ? "Editar Lembrete" : "Novo Lembrete"}</h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">O que você precisa fazer?</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Ex: Tomar remédio Ritalina" 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Detalhes adicionais (opcional)</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Ex: Após o café da manhã..." 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Repetição</label>
              <select 
                value={scheduleType} 
                onChange={e => setScheduleType(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
              >
                <option value="daily">Todos os dias (Diário)</option>
                <option value="weekly">Toda Semana (Semanal)</option>
                <option value="monthly">Todo Mês (Mensal)</option>
                <option value="custom">Personalizado (Dias da Semana Específicos)</option>
                <option value="once">Apenas uma vez</option>
              </select>
            </div>

            {scheduleType !== "custom" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Horário pre-agendado</label>
                <input 
                  type="time" 
                  value={scheduleTime} 
                  onChange={e => setScheduleTime(e.target.value)} 
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            )}

            {scheduleType === "custom" && (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-4">
                <p className="text-sm font-semibold text-blue-800">Rotinas Personalizadas</p>
                {customSchedules.map((schedule, index) => (
                  <div key={index} className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm relative">
                    {customSchedules.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeCustomSchedule(index)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <label className="block text-xs font-semibold text-slate-600 mb-2">Dias da semana:</label>
                    <div className="flex justify-between mb-3">
                      {WEEK_DAYS.map(day => {
                        const isSelected = schedule.days.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(index, day.id)}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${isSelected ? "bg-blue-600 text-white shadow-sm scale-110" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Horário nesses dias:</label>
                    <input 
                      type="time" 
                      value={schedule.time} 
                      onChange={e => updateTime(index, e.target.value)} 
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                ))}
                
                <button 
                  type="button"
                  onClick={addCustomSchedule}
                  className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700"
                >
                  <Plus size={16} /> Adicionar outro horário
                </button>
              </div>
            )}
          </div>

          <div className="mt-8">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
              ) : (
                isEditing ? <Check size={20} /> : <Plus size={20} />
              )}
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Lembrete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
