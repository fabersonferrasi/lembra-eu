"use client";

import { useState } from "react";
import { Check, Clock, CalendarDays, AlertTriangle, X, Edit2, Trash2, MoreVertical, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskCardProps {
  task: {
    id: number;
    title: string;
    description?: string;
    scheduleType: string;
    scheduleTime?: string;
    customSchedules?: { days: number[]; time: string }[];
  };
  onComplete: (taskId: number, isDoubleConfirmed: boolean) => void;
  onEdit?: (task: any) => void;
  onDelete?: (taskId: number) => void;
}

const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-lg shadow-violet-500/5 border border-white/60 overflow-visible transition-all hover:shadow-xl hover:-translate-y-1 mb-5 relative group">
      <div className="p-5">
        <div className="flex justify-between items-start mb-2 relative">
          <div className="flex-1 pr-6">
            <h3 className="text-xl font-bold text-slate-800">{task.title}</h3>
            {task.scheduleType && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold bg-violet-100/80 text-violet-700 backdrop-blur-sm border border-violet-200/50">
                {task.scheduleType === 'daily' && <Clock size={12} />}
                {task.scheduleType !== 'daily' && task.scheduleType !== 'custom' && <CalendarDays size={12} />}
                {task.scheduleType === 'custom' && <Settings size={12} />}
                
                {task.scheduleType === 'daily' ? 'Diário' : 
                 task.scheduleType === 'weekly' ? 'Semanal' : 
                 task.scheduleType === 'monthly' ? 'Mensal' : 
                 task.scheduleType === 'custom' ? 'Personalizado' : 'Uma vez'}
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

        {task.scheduleType === 'custom' && task.customSchedules ? (
          <div className="flex flex-col gap-1.5 mb-4">
            {task.customSchedules.map((cs, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-slate-500 font-medium bg-slate-50 p-2 rounded-lg">
                <Clock size={14} className="text-blue-500" />
                <span>{cs.days.map(d => DAYS_SHORT[d]).join(', ')} às {cs.time}</span>
              </div>
            ))}
          </div>
        ) : task.scheduleTime ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-4 bg-slate-50 p-2 rounded-lg w-fit">
            <Clock size={14} className="text-blue-500" />
            <span>Horário: {task.scheduleTime}</span>
          </div>
        ) : null}

        <button 
          onClick={handleFirstInteraction}
          className="w-full mt-3 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 hover:opacity-90 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md shadow-fuchsia-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Check size={20} />
          Marcar como Feito
        </button>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200" onClick={handleCancel}></div>
          <div className="bg-white/90 backdrop-blur-3xl border border-white/50 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-6 relative z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2">
              <div className="w-24 h-24 bg-rose-500 rounded-full border-8 border-white flex items-center justify-center text-white shadow-lg animate-bounce duration-500">
                <AlertTriangle size={40} className="drop-shadow-md" />
              </div>
            </div>
            
            <div className="pt-10 pb-4 text-center">
              <h4 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Atenção!</h4>
              <p className="text-slate-500 mb-6 text-base leading-relaxed">
                Temos TDAH e as vezes apenas <strong className="text-slate-800">pensamos</strong> que fizemos algo. Você <b>realmente executou</b> essa ação presencialmente agora?
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleDoubleConfirm}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm text-lg"
                >
                  <Check size={24} />
                  Sim, eu já fiz!
                </button>
                <button 
                  onClick={handleCancel}
                  className="w-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 text-base"
                >
                  <X size={20} />
                  Ops, deixei pra depois
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
