"use client";

import { useState } from "react";
import { Check, Clock, CalendarDays, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskCardProps {
  task: {
    id: number;
    title: string;
    description?: string;
    scheduleType: string;
    scheduleTime?: string;
  };
  onComplete: (taskId: number, isDoubleConfirmed: boolean) => void;
}

export function TaskCard({ task, onComplete }: TaskCardProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleFirstInteraction = () => {
    setShowConfirmation(true);
  };

  const handleDoubleConfirm = () => {
    onComplete(task.id, true);
    setShowConfirmation(false);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md mb-4 relative">
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-slate-800">{task.title}</h3>
          {task.scheduleType && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
              {task.scheduleType === 'daily' && <Clock size={12} />}
              {task.scheduleType !== 'daily' && <CalendarDays size={12} />}
              {task.scheduleType === 'daily' ? 'Diário' : 
               task.scheduleType === 'weekly' ? 'Semanal' : 
               task.scheduleType === 'monthly' ? 'Mensal' : 'Uma vez'}
            </span>
          )}
        </div>
        
        {task.description && (
          <p className="text-slate-500 mb-4 text-sm leading-relaxed">
            {task.description}
          </p>
        )}

        {task.scheduleTime && (
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-4">
              <Clock size={16} className="text-blue-500" />
              <span>Horário: {task.scheduleTime}</span>
            </div>
        )}

        <button 
          onClick={handleFirstInteraction}
          className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Check size={20} />
          Marcar como Feito
        </button>
      </div>

      {showConfirmation && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col justify-center items-center p-6 text-center animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4 animate-bounce">
            <AlertTriangle size={32} />
          </div>
          <h4 className="text-xl font-black text-slate-800 mb-2">Você tem CERTEZA?</h4>
          <p className="text-slate-600 mb-6 text-sm">
            Temos TDAH e as vezes apenas <strong>pensamos</strong> que fizemos algo. Você realmente executou essa ação mundo real?
          </p>
          
          <div className="flex flex-col gap-3 w-full">
            <button 
              onClick={handleDoubleConfirm}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Check size={20} />
              Sim, eu realmente fiz agora!
            </button>
            <button 
              onClick={handleCancel}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <X size={20} />
              Ops, ainda não fiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
