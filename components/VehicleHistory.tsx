
import React, { useState, useMemo, useEffect } from 'react';
import { ActivityLog } from '../types';
import { ALERT_THRESHOLDS } from '../constants';
// Removed parseISO as it was causing an export error
import { format } from 'date-fns';
// Changed import path to specifically target pt-BR to fix export error from 'date-fns/locale'
import { ptBR } from 'date-fns/locale/pt-BR';

interface VehicleHistoryProps {
  vehicleId: string;
  vehicleModel: string;
  logs: ActivityLog[];
  onClose: () => void;
  onAddNote?: (note: string) => void;
  isDarkMode?: boolean;
}

const VehicleHistory: React.FC<VehicleHistoryProps> = ({ vehicleId, vehicleModel, logs, onClose, onAddNote, isDarkMode = false }) => {
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('yard_history_search') || '');
  const [startDate, setStartDate] = useState<string>(() => localStorage.getItem('yard_history_start') || '');
  const [endDate, setEndDate] = useState<string>(() => localStorage.getItem('yard_history_end') || '');
  const [statusFilter, setStatusFilter] = useState<string>(() => localStorage.getItem('yard_history_status') || 'all');
  const [plateFilter, setPlateFilter] = useState(() => localStorage.getItem('yard_history_plate') || '');
  const [slaFilter, setSlaFilter] = useState<string>(() => localStorage.getItem('yard_history_sla') || 'all');
  const [visibleCount, setVisibleCount] = useState(10);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Removed the useEffect that was causing cascading renders
  // setVisibleCount(10) will be called in handlers

  useEffect(() => {
    localStorage.setItem('yard_history_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('yard_history_start', startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem('yard_history_end', endDate);
  }, [endDate]);

  useEffect(() => {
    localStorage.setItem('yard_history_status', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('yard_history_plate', plateFilter);
  }, [plateFilter]);

  useEffect(() => {
    localStorage.setItem('yard_history_sla', slaFilter);
  }, [slaFilter]);

  const entryTimesMap = useMemo(() => {
    const map: Record<string, string> = {};
    // Sort logs by timestamp ascending to find the entry event for each vehicle
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    sortedLogs.forEach(log => {
      if (log.action === 'entry' && !map[log.vehicleId]) {
        map[log.vehicleId] = log.timestamp;
      }
    });
    return map;
  }, [logs]);

  const vehicleLogs = useMemo(() => {
    return logs
      .filter(log => {
        // If plateFilter is active, search across all logs. Otherwise, stick to current vehicle.
        if (plateFilter) {
          const plate = (log.vehiclePlate || log.vehicleId || '').toLowerCase();
          if (!plate.includes(plateFilter.toLowerCase())) return false;
        } else {
          if (log.vehicleId !== vehicleId) return false;
        }
        
        if (statusFilter !== 'all' && log.action !== statusFilter) return false;
        
        // SLA Filtering
        if (slaFilter !== 'all') {
          const entryTime = entryTimesMap[log.vehicleId];
          if (!entryTime) {
            if (slaFilter !== 'normal') return false; // Vehicles with no entry log are considered "Normal" for now
          } else {
            const logTime = new Date(log.timestamp).getTime();
            const entryT = new Date(entryTime).getTime();
            const stayHours = (logTime - entryT) / 3600000;

            if (slaFilter === 'normal' && stayHours >= ALERT_THRESHOLDS.WARNING) return false;
            if (slaFilter === 'warning' && (stayHours < ALERT_THRESHOLDS.WARNING || stayHours >= ALERT_THRESHOLDS.CRITICAL)) return false;
            if (slaFilter === 'critical' && (stayHours < ALERT_THRESHOLDS.CRITICAL || stayHours >= ALERT_THRESHOLDS.SEVERE)) return false;
            if (slaFilter === 'severe' && stayHours < ALERT_THRESHOLDS.SEVERE) return false;
          }
        }
        
        if (!startDate && !endDate) return true;
        const logDate = new Date(log.timestamp);
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) return false;
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (logDate > end) return false;
        }
        
        return true;
      })
      .filter(log => log.details.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, vehicleId, searchTerm, startDate, endDate, statusFilter, plateFilter, slaFilter, entryTimesMap]);

  const paginatedLogs = useMemo(() => {
    return vehicleLogs.slice(0, visibleCount);
  }, [vehicleLogs, visibleCount]);

  const getActionConfig = (action: string) => {
    switch (action) {
      case 'entry': return { icon: 'fa-sign-in-alt', color: 'bg-emerald-500', label: 'Check-in' };
      case 'exit': return { icon: 'fa-flag-checkered', color: isDarkMode ? 'bg-slate-700' : 'bg-slate-900', label: 'Saída' };
      case 'status_change': return { icon: 'fa-sync-alt', color: 'bg-blue-500', label: 'Status' };
      case 'consultant_change': return { icon: 'fa-user-tie', color: 'bg-purple-500', label: 'Consultor' };
      case 'note': return { icon: 'fa-sticky-note', color: 'bg-amber-500', label: 'Anotação' };
      default: return { icon: 'fa-info-circle', color: 'bg-slate-400', label: 'Evento' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-end z-[200] p-0 md:p-4">
      <div className={`w-full max-w-lg h-full md:h-[95vh] md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-500 border-l transition-colors ${isDarkMode ? 'bg-[#0F1117] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
        <div className={`p-8 border-b transition-colors ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border mb-2 inline-block ${isDarkMode ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>Timeline</span>
              <h2 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{vehicleModel}</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">ID: {vehicleId}</p>
            </div>
            <button onClick={onClose} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>
          
          <div className="flex flex-col gap-3 mb-6">
            <div className="relative">
              <i className={`fas fa-id-card absolute left-4 top-1/2 -translate-y-1/2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
              <input
                type="text"
                placeholder="PESQUISAR POR PLACA..."
                value={plateFilter}
                onChange={(e) => { setPlateFilter(e.target.value.toUpperCase()); setVisibleCount(10); }}
                className={`w-full pl-10 pr-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none transition-all border ${
                  isDarkMode 
                    ? 'bg-blue-600/10 border-blue-500/20 text-white focus:border-blue-500/50 focus:bg-blue-600/20' 
                    : 'bg-white border-slate-200 text-slate-700 focus:border-blue-500/30 focus:shadow-lg focus:shadow-blue-500/5'
                }`}
              />
              {plateFilter && (
                <button 
                  onClick={() => setPlateFilter('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
            </div>

            <div className="relative">
              <i className={`fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
              <input
                type="text"
                placeholder="BUSCAR NO CONTEÚDO..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(10); }}
                className={`w-full pl-10 pr-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none transition-all border ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50 focus:bg-white/10' 
                    : 'bg-white border-slate-200 text-slate-700 focus:border-blue-500/30 focus:shadow-lg focus:shadow-blue-500/5'
                }`}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <i className="fas fa-times-circle"></i>
                </button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <span className="block text-[9px] font-black text-slate-400 uppercase mb-1">Eventos</span>
              <span className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{vehicleLogs.length}</span>
            </div>
            {vehicleLogs.find(l => l.action === 'exit') && (
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                <span className="block text-[9px] font-black text-emerald-500 uppercase mb-1">Permanência</span>
                <span className={`text-xl font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{vehicleLogs.find(l => l.action === 'exit')?.duration}</span>
              </div>
            )}
          </div>

          {onAddNote && (
            <div className="mb-6">
              <button 
                onClick={() => setIsAddingNote(!isAddingNote)}
                className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
              >
                <i className={`fas ${isAddingNote ? 'fa-times' : 'fa-plus'}`}></i>
                {isAddingNote ? 'Cancelar Anotação' : 'Adicionar Anotação'}
              </button>
              
              {isAddingNote && (
                <div className="mt-3 animate-in slide-in-from-top-2">
                  <textarea 
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="DIGITE SUA ANOTAÇÃO AQUI..."
                    className={`w-full p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none transition-all border h-24 resize-none ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' 
                        : 'bg-white border-slate-200 text-slate-700 focus:border-blue-500/30'
                    }`}
                  />
                  <div className="flex justify-end mt-2">
                    <button 
                      onClick={() => {
                        if (newNote.trim()) {
                          onAddNote(newNote);
                          setNewNote('');
                          setIsAddingNote(false);
                        }
                      }}
                      disabled={!newNote.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      Salvar Manual
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Filtros Avançados</span>
              {(startDate || endDate || statusFilter !== 'all' || plateFilter || slaFilter !== 'all') && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter('all'); setPlateFilter(''); setSlaFilter('all'); }}
                  className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors"
                >
                  Limpar Tudo
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <i className={`fas fa-calendar-alt absolute left-3 top-1/2 -translate-y-1/2 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setVisibleCount(10); }}
                    className={`w-full pl-8 pr-3 py-2.5 rounded-xl text-[10px] font-bold outline-none border transition-all ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' 
                        : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-blue-500/30'
                    }`}
                  />
                </div>
                <div className="relative">
                  <i className={`fas fa-calendar-alt absolute left-3 top-1/2 -translate-y-1/2 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setVisibleCount(10); }}
                    className={`w-full pl-8 pr-3 py-2.5 rounded-xl text-[10px] font-bold outline-none border transition-all ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' 
                        : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-blue-500/30'
                    }`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <i className={`fas fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setVisibleCount(10); }}
                    className={`w-full pl-8 pr-8 py-2.5 rounded-xl text-[10px] font-bold outline-none border appearance-none transition-all ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' 
                        : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-blue-500/30'
                    }`}
                  >
                    <option value="all">EVENTOS: TODOS</option>
                    <option value="entry">CHECK-IN / ENTRADA</option>
                    <option value="exit">SAÍDA / FINALIZADO</option>
                    <option value="status_change">MUDANÇA DE STATUS</option>
                    <option value="consultant_change">TROCA DE CONSULTOR</option>
                    <option value="note">ANOTAÇÕES / OBS.</option>
                  </select>
                  <i className={`fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
                </div>
                <div className="relative">
                  <i className={`fas fa-stopwatch absolute left-3 top-1/2 -translate-y-1/2 text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
                  <select
                    value={slaFilter}
                    onChange={(e) => { setSlaFilter(e.target.value); setVisibleCount(10); }}
                    className={`w-full pl-8 pr-8 py-2.5 rounded-xl text-[10px] font-bold outline-none border appearance-none transition-all ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' 
                        : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-blue-500/30'
                    }`}
                  >
                    <option value="all">SLA: TODOS</option>
                    <option value="normal">EFICAZ (&lt; {ALERT_THRESHOLDS.WARNING}h)</option>
                    <option value="warning">EM ALERTA ({ALERT_THRESHOLDS.WARNING}h+)</option>
                    <option value="critical">CRÍTICO ({ALERT_THRESHOLDS.CRITICAL}h+)</option>
                    <option value="severe">EXCEDIDO ({ALERT_THRESHOLDS.SEVERE}h+)</option>
                  </select>
                  <i className={`fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {paginatedLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40 text-slate-400">
              <i className="fas fa-history text-5xl mb-4"></i>
              <p className="text-xs font-black uppercase">Vazio</p>
            </div>
          ) : (
            <div className="relative">
              <div className={`absolute left-6 top-0 bottom-0 w-0.5 ${isDarkMode ? 'bg-white/5' : 'bg-slate-200'}`}></div>
              <div className="space-y-10">
                {paginatedLogs.map((log) => {
                  const cfg = getActionConfig(log.action);
                  return (
                    <div key={log.id} className="relative pl-16 group">
                      <div className={`absolute left-0 w-12 h-12 rounded-2xl ${cfg.color} flex items-center justify-center text-white shadow-xl z-10 transition-transform group-hover:scale-110`}>
                        <i className={`fas ${cfg.icon}`}></i>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center flex-wrap gap-2">
                          {log.vehiclePlate && (
                            <span className="text-blue-500">{log.vehiclePlate}</span>
                          )}
                          {log.vehiclePlate && <span>•</span>}
                          {/* SLA indicator in log */}
                          {(() => {
                            const entryTime = entryTimesMap[log.vehicleId];
                            if (entryTime) {
                              const stayHours = (new Date(log.timestamp).getTime() - new Date(entryTime).getTime()) / 3600000;
                              if (stayHours >= ALERT_THRESHOLDS.SEVERE) return <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[8px] border border-red-500/20">EXCEDIDO</span>;
                              if (stayHours >= ALERT_THRESHOLDS.CRITICAL) return <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 text-[8px] border border-orange-500/20">CRÍTICO</span>;
                              if (stayHours >= ALERT_THRESHOLDS.WARNING) return <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[8px] border border-amber-500/20">EM ALERTA</span>;
                            }
                            return null;
                          })()}
                          <span className="ml-auto">
                            {format(new Date(log.timestamp), "dd/MM '•' HH:mm", { locale: ptBR })}
                          </span>
                        </span>
                        <h4 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{cfg.label}</h4>
                        <p className={`text-xs font-medium leading-relaxed mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{log.details}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleCount < vehicleLogs.length && (
                <div className="mt-12 flex justify-center pl-16">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 10)}
                    className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                    }`}
                  >
                    <i className="fas fa-plus-circle mr-2"></i>
                    Carregar Mais ({vehicleLogs.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehicleHistory;
