
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ActivityLog } from '../types';
import { format, differenceInMinutes, isSameDay, parseISO } from 'date-fns';

interface IdleHistoryProps {
  allLogs: ActivityLog[];
  onUpdateLog: (logId: string, updates: Partial<ActivityLog>, yardId?: string) => void;
  isDarkMode?: boolean;
}

interface IdlePeriod {
  logId: string;
  yardId: string;
  yardName: string;
  slotIndex: number;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  reason?: string;
  actions?: string;
}

const IdleHistory: React.FC<IdleHistoryProps> = ({ allLogs, onUpdateLog, isDarkMode }) => {
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterReason, setFilterReason] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState('');
  const [editActions, setEditActions] = useState('');

  const idlePeriods = useMemo(() => {
    const periods: IdlePeriod[] = [];
    
    // Agrupar logs por pátio e vaga
    const logsBySlot: Record<string, ActivityLog[]> = {};
    
    allLogs.forEach(log => {
      // Extrair número da vaga dos detalhes se possível, ou usar yardId
      const slotMatch = log.details.match(/Vaga (\d+)/);
      if (slotMatch && log.yardId) {
        const slotIdx = parseInt(slotMatch[1]) - 1;
        const key = `${log.yardId}-${slotIdx}`;
        if (!logsBySlot[key]) logsBySlot[key] = [];
        logsBySlot[key].push(log);
      }
    });

    Object.entries(logsBySlot).forEach(([key, slotLogs]) => {
      const [yardId, slotIdxStr] = key.split('-');
      const slotIdx = parseInt(slotIdxStr);
      
      // Ordenar logs cronologicamente
      const sortedLogs = [...slotLogs].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (let i = 0; i < sortedLogs.length; i++) {
        const currentLog = sortedLogs[i];
        
        if (currentLog.action === 'exit') {
          const startTime = currentLog.timestamp;
          // Encontrar a próxima entrada nesta vaga
          const nextEntry = sortedLogs.slice(i + 1).find(l => l.action === 'entry');
          const endTime = nextEntry ? nextEntry.timestamp : null;
          
          const end = nextEntry ? new Date(nextEntry.timestamp) : new Date();
          const durationMinutes = differenceInMinutes(end, new Date(startTime));

          // Apenas registrar ociosidade significativa (ex: > 10 min)
          if (durationMinutes > 10) {
            periods.push({
              logId: currentLog.id,
              yardId: currentLog.yardId || yardId,
              yardName: currentLog.yardName || 'Pátio',
              slotIndex: slotIdx,
              startTime,
              endTime,
              durationMinutes,
              reason: currentLog.idleReason,
              actions: currentLog.idleActions
            });
          }
        }
      }
    });

    return periods.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [allLogs]);

  const filteredPeriods = useMemo(() => {
    return idlePeriods.filter(p => {
      const matchesDate = !filterDate || isSameDay(parseISO(p.startTime), parseISO(filterDate));
      const matchesReason = !filterReason || 
        (p.reason && p.reason.toLowerCase().includes(filterReason.toLowerCase())) ||
        (p.actions && p.actions.toLowerCase().includes(filterReason.toLowerCase()));
      return matchesDate && matchesReason;
    });
  }, [idlePeriods, filterDate, filterReason]);

  const handleStartEdit = (p: IdlePeriod) => {
    setEditingId(p.logId);
    setEditReason(p.reason || '');
    setEditActions(p.actions || '');
  };

  const handleSaveEdit = (p: IdlePeriod) => {
    onUpdateLog(p.logId, { 
      idleReason: editReason, 
      idleActions: editActions 
    }, p.yardId);
    setEditingId(null);
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}min`;
  };

  return (
    <div className={`p-8 h-full flex flex-col gap-6 ${isDarkMode ? 'bg-[#0A0B10]' : 'bg-slate-50'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className={`text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Histórico de Ociosidade
          </h2>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">
            Análise de tempo vago por vaga e pátio
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={`h-12 px-5 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
            />
          </div>
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input 
              type="text"
              placeholder="FILTRAR POR MOTIVO OU AÇÃO..."
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className={`h-12 pl-12 pr-6 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all w-64 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
            />
          </div>
        </div>
      </div>

      <div className={`flex-1 rounded-[2.5rem] border overflow-hidden flex flex-col ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`grid grid-cols-12 gap-4 p-6 border-b text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'border-white/5 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
          <div className="col-span-2">Pátio / Vaga</div>
          <div className="col-span-2">Início / Fim</div>
          <div className="col-span-1">Duração</div>
          <div className="col-span-3">Motivo da Ociosidade</div>
          <div className="col-span-3">Ações Tomadas</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredPeriods.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 p-12">
              <i className="fas fa-history text-4xl mb-4"></i>
              <p className="text-sm font-black uppercase tracking-widest">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-500/10">
              {filteredPeriods.map((p) => (
                <motion.div 
                  key={p.logId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`grid grid-cols-12 gap-4 p-6 items-center transition-colors group ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                >
                  <div className="col-span-2">
                    <div className="flex flex-col">
                      <span className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.yardName}</span>
                      <span className="text-[10px] font-bold text-blue-500 uppercase">Vaga {p.slotIndex + 1}</span>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-sign-out-alt text-[9px] text-red-500"></i>
                        <span className={`text-[10px] font-mono font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {format(parseISO(p.startTime), 'dd/MM HH:mm')}
                        </span>
                      </div>
                      {p.endTime ? (
                        <div className="flex items-center gap-2">
                          <i className="fas fa-sign-in-alt text-[9px] text-emerald-500"></i>
                          <span className={`text-[10px] font-mono font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            {format(parseISO(p.endTime), 'dd/MM HH:mm')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 w-fit">Em Aberto</span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-1">
                    <span className={`text-sm font-black font-mono ${p.durationMinutes > 1440 ? 'text-red-500' : (p.durationMinutes > 720 ? 'text-orange-500' : (isDarkMode ? 'text-white' : 'text-slate-700'))}`}>
                      {formatDuration(p.durationMinutes)}
                    </span>
                  </div>

                  <div className="col-span-3">
                    {editingId === p.logId ? (
                      <textarea 
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="Informe o motivo..."
                        className={`w-full p-3 rounded-xl text-xs font-medium border focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none h-20 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'}`}
                      />
                    ) : (
                      <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {p.reason || <span className="italic opacity-50">Não informado</span>}
                      </p>
                    )}
                  </div>

                  <div className="col-span-3">
                    {editingId === p.logId ? (
                       <textarea 
                        value={editActions}
                        onChange={(e) => setEditActions(e.target.value)}
                        placeholder="Ações tomadas..."
                        className={`w-full p-3 rounded-xl text-xs font-medium border focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none h-20 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'}`}
                      />
                    ) : (
                      <div className={`p-4 rounded-2xl border border-dashed flex flex-col gap-2 transition-all ${
                        p.actions 
                          ? (isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20 shadow-inner' : 'bg-emerald-50 border-emerald-200 shadow-sm') 
                          : (isDarkMode ? 'bg-white/[0.03] border-white/10 opacity-60' : 'bg-slate-50 border-slate-100 opacity-60')
                      }`}>
                        <div className="flex items-center gap-2">
                          <i className={`fas fa-clipboard-check text-[10px] ${p.actions ? 'text-emerald-500' : 'text-slate-400'}`}></i>
                          <span className={`text-[8px] font-black uppercase tracking-widest ${p.actions ? 'text-emerald-600' : 'text-slate-400'}`}>
                            Log de Resolução
                          </span>
                        </div>
                        <p className={`text-[11px] font-bold leading-relaxed italic ${
                          p.actions 
                            ? (isDarkMode ? 'text-slate-200' : 'text-slate-700') 
                            : (isDarkMode ? 'text-slate-500' : 'text-slate-400')
                        }`}>
                          {p.actions || "Nenhuma ação registrada"}
                        </p>
                        {p.actions && (
                          <div className={`h-1 w-8 rounded-full ${isDarkMode ? 'bg-emerald-500/30' : 'bg-emerald-500/20'}`}></div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-1 text-right">
                    {editingId === p.logId ? (
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => handleSaveEdit(p)}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
                        >
                          Salvar
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleStartEdit(p)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${isDarkMode ? 'bg-white/5 text-slate-400 hover:text-blue-400' : 'bg-slate-100 text-slate-400 hover:text-blue-600'}`}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdleHistory;
