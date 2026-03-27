"use client";

import { useState } from "react";
import { Check, Clock, CalendarDays, AlertTriangle, X, Edit2, Trash2, MoreVertical } from "lucide-react";
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
  onEdit?: (task: any) => void;
  onDelete?: (taskId: number) => void;
}

export function TaskCard({ task, onComplete, onEdit, onDelete }: TaskCardProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-visible transition-all hover:shadow-md mb-4 relative">
      <div className="p-5">
        <div className="flex justify-between items-start mb-2 relative">
          <div className="flex-1 pr-6">
            <h3 className="text-xl font-bold text-slate-800">{task.title}</h3>
            {task.scheduleType && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                {task.scheduleType === 'daily' && <Clock size={12} />}
                {task.scheduleType !== 'daily' && <CalendarDays size={12} />}
                {task.scheduleType === 'daily' ? 'Diário' : 
                 task.scheduleType === 'weekly' ? 'Semanal' : 
                 task.scheduleType === 'monthly' ? 'Mensal' : 'Uma vez'}
              </span>
            )}
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full bg-slate-50 transition-colors"
            >
              <MoreVertical size={20} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-100">
                <button 
                  onClick={() => { setShowMenu(false); onEdit?.(task); }} 
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2"
                >
                  <Edit2 size={14} /> Editar
                </button>
                <button 
                  onClick={() => { setShowMenu(false); onDelete?.(task.id); }} 
                  className="w-full text-left px-4 py-2 hover:bg-rose-50 text-sm font-medium text-rose-600 flex items-center gap-2"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            )}
            {/* Click outside overlay */}
            {showMenu && <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>}
          </div>
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
