"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

interface TaskFormProps {
  onSubmit: (task: any) => void;
  onCancel: () => void;
}

export function TaskForm({ onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleType, setScheduleType] = useState("daily");
  const [scheduleTime, setScheduleTime] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSubmit({
      title,
      description,
      scheduleType,
      scheduleTime,
      createdAt: new Date(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 bg-slate-50 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Novo Lembrete</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">
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
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Detalhes adicionais (opcional)</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Ex: Após o café da manhã..." 
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none h-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Repetição</label>
                <select 
                  value={scheduleType} 
                  onChange={e => setScheduleType(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
                >
                  <option value="daily">Todos os dias</option>
                  <option value="weekly">Semanalmente</option>
                  <option value="monthly">Mensalmente</option>
                  <option value="once">Apenas uma vez</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Horário</label>
                <input 
                  type="time" 
                  value={scheduleTime} 
                  onChange={e => setScheduleTime(e.target.value)} 
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Criar Lembrete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
