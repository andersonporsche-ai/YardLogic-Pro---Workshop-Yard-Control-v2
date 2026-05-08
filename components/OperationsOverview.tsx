
import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Vehicle, ActivityLog } from '../types';
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, subDays, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface OperationsOverviewProps {
  vehicles: Vehicle[];
  activityLogs: ActivityLog[];
  isDarkMode?: boolean;
  onEntryClick: (predefinedService?: string) => void;
  onExitClick: (vehicle: Vehicle) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const OperationsOverview: React.FC<OperationsOverviewProps> = ({
  vehicles,
  activityLogs,
  isDarkMode = false,
  onEntryClick,
  onExitClick
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'consultants'>('daily');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeSegment, setActiveSegment] = useState<'all' | 'pdi_seminovos'>('all');

  const consultantStats = useMemo(() => {
    const stats: Record<string, { totalTime: number, count: number, name: string, active: number }> = {};

    // Base current vehicles
    vehicles.forEach(v => {
      if (!stats[v.consultant]) {
        stats[v.consultant] = { totalTime: 0, count: 0, name: v.consultant, active: 0 };
      }
      stats[v.consultant].active++;
    });

    // Historic exits for stay duration (last 30 days or current month)
    const periodLogs = activityLogs.filter(log => {
      if (log.action !== 'exit') return false;
      const logDate = new Date(log.timestamp);
      return isSameMonth(logDate, selectedDate);
    });

    periodLogs.forEach(log => {
      // Find the corresponding entry log to calculate duration
      const entryLog = activityLogs.find(l => 
        l.vehicleId === log.vehicleId && 
        l.action === 'entry' && 
        new Date(l.timestamp) < new Date(log.timestamp)
      );

      if (entryLog) {
        const duration = differenceInMinutes(new Date(log.timestamp), new Date(entryLog.timestamp));
        // We need to know who the consultant was. Since activityLog doesn't store consultant name directly in the old schema
        // but the current vehicle might have it or we check the details.
        // Assuming details contains consultant name or we can find it.
        // In a real app we'd store consultantId in ActivityLog.
        // Let's look for consultant name in log details or assume the current vehicle's consultant if it's the same record.
        const consultantMatch = log.details.match(/Consultor: (.*?)(?:,|$)/);
        const name = consultantMatch ? consultantMatch[1] : 'Indefinido';

        if (!stats[name]) {
          stats[name] = { totalTime: 0, count: 0, name: name, active: 0 };
        }
        stats[name].totalTime += duration;
        stats[name].count++;
      }
    });

    return Object.values(stats).map(s => ({
      ...s,
      avgStayHours: s.count > 0 ? (s.totalTime / s.count / 60).toFixed(1) : 0,
      efficiencyScore: s.count > 0 ? Math.max(0, 100 - (s.totalTime / s.count / 60 / 24) * 10).toFixed(0) : 'N/A'
    })).sort((a, b) => b.count - a.count);
  }, [vehicles, activityLogs, selectedDate]);

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      
      const matchesSearch = 
        log.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.vehicleModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // New Segment Filter
      if (activeSegment === 'pdi_seminovos') {
        const isPDIorSeminovo = 
          log.serviceType?.includes('PDI') || 
          log.serviceType?.includes('Seminovos') ||
          log.details.toLowerCase().includes('pdi') ||
          log.details.toLowerCase().includes('seminov');
        if (!isPDIorSeminovo) return false;
      }

      if (viewMode === 'daily') {
        return isSameDay(logDate, selectedDate);
      } else {
        return isSameMonth(logDate, selectedDate);
      }
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activityLogs, viewMode, searchTerm, selectedDate, activeSegment]);

  const stats = useMemo(() => {
    const entries = filteredLogs.filter(l => l.action === 'entry').length;
    const exits = filteredLogs.filter(l => l.action === 'exit').length;
    
    // PDI/Seminovos specific for the current interval (selected date day or month)
    const pdiLogs = activityLogs.filter(log => {
      const d = new Date(log.timestamp);
      const isDateMatch = viewMode === 'daily' ? isSameDay(d, selectedDate) : isSameMonth(d, selectedDate);
      if (!isDateMatch) return false;
      
      return log.serviceType?.includes('PDI') || log.serviceType?.includes('Seminovos') || 
             log.details.toLowerCase().includes('pdi') || log.details.toLowerCase().includes('seminov');
    });

    return { 
      entries, 
      exits, 
      statusChanges: filteredLogs.filter(l => l.action === 'status_change').length,
      pdiEntries: pdiLogs.filter(l => l.action === 'entry').length,
      pdiExits: pdiLogs.filter(l => l.action === 'exit').length
    };
  }, [filteredLogs, activityLogs, viewMode, selectedDate]);

  // Grouped by day for monthly view
  const groupedLogs = useMemo(() => {
    if (viewMode === 'daily') return null;

    const days = eachDayOfInterval({
      start: startOfMonth(selectedDate),
      end: endOfMonth(selectedDate)
    });

    return days.map(day => {
      const dayLogs = activityLogs.filter(l => {
        if (!isSameDay(new Date(l.timestamp), day)) return false;
        
        if (activeSegment === 'pdi_seminovos') {
          return l.serviceType?.includes('PDI') || 
                 l.serviceType?.includes('Seminovos') ||
                 l.details.toLowerCase().includes('pdi') ||
                 l.details.toLowerCase().includes('seminov');
        }
        return true;
      });
      return {
        date: day,
        entries: dayLogs.filter(l => l.action === 'entry').length,
        exits: dayLogs.filter(l => l.action === 'exit').length,
        logs: dayLogs
      };
    }).filter(d => d.logs.length > 0).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [activityLogs, viewMode, selectedDate, activeSegment]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`p-4 md:p-8 flex flex-col gap-8 h-full overflow-y-auto custom-scrollbar print:overflow-visible print:h-auto print:p-0 ${isDarkMode ? 'bg-[#07080C] text-white' : 'bg-[#F9FAFB] text-slate-800'}`}>
      
      {/* Header with Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:mb-8">
        <div className="flex justify-between items-center w-full md:w-auto">
          <div>
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Visão Geral de Operações</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Gestão Centralizada de Fluxo Porsche</p>
          </div>
          
          <button 
            onClick={handlePrint}
            className={`md:hidden px-4 py-3 rounded-xl border flex items-center gap-2 transition-all print:hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
          >
            <i className="fas fa-print"></i>
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto print:hidden">
          <button 
            onClick={handlePrint}
            className={`hidden md:flex px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all items-center gap-3 ${isDarkMode ? 'bg-white/5 text-white border-white/10 hover:bg-white/10' : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50 shadow-sm border'}`}
          >
            <i className="fas fa-print"></i>
            Imprimir
          </button>

          {/* Fluxo Geral */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEntryClick()}
              className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3"
            >
              <i className="fas fa-plus"></i>
              Check-in
            </button>
            
            <div className="relative group">
              <button 
                className={`px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 ${isDarkMode ? 'bg-white/5 text-white border-white/10 hover:bg-white/10' : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50 shadow-sm border'}`}
              >
                <i className="fas fa-sign-out-alt"></i>
                Saída
              </button>
              
              <div className={`absolute right-0 top-full mt-2 w-72 rounded-[2rem] border shadow-2xl backdrop-blur-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all z-[100] p-4 ${isDarkMode ? 'bg-[#12141C]/90 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                <h5 className="text-[10px] font-black uppercase tracking-widest mb-4 px-2">Veículos no Pátio</h5>
                <div className="max-h-60 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                  {vehicles.length === 0 ? (
                    <p className="text-center py-4 text-slate-500 text-[10px] font-bold uppercase">Vazio</p>
                  ) : (
                    vehicles.map(v => (
                      <button 
                        key={v.id}
                        onClick={() => onExitClick(v)}
                        className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-white border-b-2" style={{ borderBottomColor: v.prisma.color }}>
                          {v.prisma.number}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-black uppercase truncate">{v.plate}</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase truncate">{v.model}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Fluxo PDI */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEntryClick('PDI')}
              className="px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3"
            >
              <i className="fas fa-file-check"></i>
              Posto PDI
            </button>

            <div className="relative group">
              <button 
                className={`px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 ${isDarkMode ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 shadow-sm border'}`}
              >
                <i className="fas fa-door-open"></i>
                Saída PDI
              </button>
              
              <div className={`absolute right-0 top-full mt-2 w-72 rounded-[2rem] border shadow-2xl backdrop-blur-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all z-[100] p-4 ${isDarkMode ? 'bg-[#12141C]/90 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                <h5 className="text-[10px] font-black uppercase tracking-widest mb-4 px-2">Veículos PDI Ativos</h5>
                <div className="max-h-60 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                  {vehicles.filter(v => v.service?.includes('PDI')).length === 0 ? (
                    <p className="text-center py-4 text-slate-500 text-[10px] font-bold uppercase">Nenhum PDI em andamento</p>
                  ) : (
                    vehicles.filter(v => v.service?.includes('PDI')).map(v => (
                      <button 
                        key={v.id}
                        onClick={() => onExitClick(v)}
                        className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-white border-b-2" style={{ borderBottomColor: v.prisma.color }}>
                          {v.prisma.number}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-black uppercase truncate">{v.plate}</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase truncate">{v.model}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Fluxo Seminovos */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEntryClick('Veículos Seminovos')}
              className="px-6 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-3"
            >
              <i className="fas fa-car-side"></i>
              Semi Novos
            </button>

            <div className="relative group">
              <button 
                className={`px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 ${isDarkMode ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 shadow-sm border'}`}
              >
                <i className="fas fa-external-link-alt"></i>
                Saída SN
              </button>
              
              <div className={`absolute right-0 top-full mt-2 w-72 rounded-[2rem] border shadow-2xl backdrop-blur-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all z-[100] p-4 ${isDarkMode ? 'bg-[#12141C]/90 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                <h5 className="text-[10px] font-black uppercase tracking-widest mb-4 px-2">Seminovos em Estoque</h5>
                <div className="max-h-60 overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                  {vehicles.filter(v => v.service?.includes('Seminovos')).length === 0 ? (
                    <p className="text-center py-4 text-slate-500 text-[10px] font-bold uppercase">Nenhum seminovo no pátio</p>
                  ) : (
                    vehicles.filter(v => v.service?.includes('Seminovos')).map(v => (
                      <button 
                        key={v.id}
                        onClick={() => onExitClick(v)}
                        className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-all ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-white border-b-2" style={{ borderBottomColor: v.prisma.color }}>
                          {v.prisma.number}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-black uppercase truncate">{v.plate}</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase truncate">{v.model}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Fluxo PDI / Seminovos */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEntryClick('PDI / Veículos Seminovos')}
              className="px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-3"
            >
              <i className="fas fa-exchange-alt"></i>
              PDI / SN
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className={`p-6 rounded-[2rem] border transition-all ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <i className="fas fa-sign-in-alt"></i>
            </div>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{viewMode === 'daily' ? 'Hoje' : 'Mês'}</span>
          </div>
          <h3 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats.entries}</h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Entradas Registradas</p>
        </div>

        <div className={`p-6 rounded-[2rem] border transition-all ${isDarkMode ? 'bg-blue-500/5 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.05)]' : 'bg-blue-50 border-blue-100'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <i className="fas fa-flag-checkered"></i>
            </div>
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{viewMode === 'daily' ? 'Hoje' : 'Mês'}</span>
          </div>
          <h3 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats.exits}</h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Saídas Realizadas</p>
        </div>

        <div className={`p-6 rounded-[2rem] border transition-all ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.05)]' : 'bg-indigo-50 border-indigo-100'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fas fa-sync-alt"></i>
            </div>
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{viewMode === 'daily' ? 'Hoje' : 'Mês'}</span>
          </div>
          <h3 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats.statusChanges}</h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Atualizações Diárias</p>
        </div>

        <div className={`p-6 rounded-[2rem] border transition-all ${isDarkMode ? 'bg-amber-600/5 border-amber-600/20 shadow-[0_0_30px_rgba(217,119,6,0.05)]' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-600/20">
              <i className="fas fa-car-side"></i>
            </div>
            <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">{viewMode === 'daily' ? 'Hoje' : 'Mês'}</span>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <h3 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats.pdiEntries}</h3>
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-1">Entradas PDI/SN</p>
            </div>
            <div className="mb-1 h-8 w-px bg-slate-300/20"></div>
            <div>
              <h3 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats.pdiExits}</h3>
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mt-1">Saídas PDI/SN</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Navigation */}
      <div className={`p-6 rounded-[2.5rem] border ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-white/5 w-full md:w-auto">
            <button 
              onClick={() => setViewMode('daily')}
              className={`flex-1 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'daily' ? 'bg-white dark:bg-white/10 shadow-md text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Diário
            </button>
            <button 
              onClick={() => setViewMode('monthly')}
              className={`flex-1 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'monthly' ? 'bg-white dark:bg-white/10 shadow-md text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Mensal
            </button>
            <button 
              onClick={() => setViewMode('consultants')}
              className={`flex-1 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'consultants' ? 'bg-white dark:bg-white/10 shadow-md text-blue-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Consultores
            </button>
          </div>

          <div className="flex p-1.5 rounded-2xl bg-slate-100 dark:bg-white/5 w-full md:w-auto">
            <button 
              onClick={() => setActiveSegment('all')}
              className={`flex-1 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all ${activeSegment === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setActiveSegment('pdi_seminovos')}
              className={`flex-1 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all ${activeSegment === 'pdi_seminovos' ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              PDI & Seminovos
            </button>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => setSelectedDate(prev => viewMode === 'daily' ? subDays(prev, 1) : subMonths(prev, 1))}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-slate-100'}`}
            >
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <div className="text-center min-w-[120px]">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                {viewMode === 'daily' ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <button 
              onClick={() => {
                const next = viewMode === 'daily' ? new Date(selectedDate.getTime() + 86400000) : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
                if (next <= new Date()) setSelectedDate(next);
              }}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-slate-100'} disabled:opacity-30 disabled:pointer-events-none`}
              disabled={viewMode === 'daily' ? isSameDay(selectedDate, new Date()) : isSameMonth(selectedDate, new Date())}
            >
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <i className={`fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}></i>
            <input 
              type="text"
              placeholder="Buscar histórico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest outline-none border transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500/30'}`}
            />
          </div>
        </div>
      </div>

      {/* Logs Table / List / Consultant Report */}
      <div className="flex-1 min-h-0">
        {viewMode === 'consultants' ? (
          <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Top Row: Comparative Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Avg Stay Bar Chart */}
              <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="mb-8">
                  <h4 className="text-sm font-black uppercase tracking-tight">Permanência Média (Horas)</h4>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Eficiência por Consultor no Mês</p>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={consultantStats} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#ffffff10' : '#00000008'} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fontWeight: 700, fill: isDarkMode ? '#64748b' : '#94a3b8' }}
                        interval={0}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: isDarkMode ? '#64748b' : '#94a3b8' }} />
                      <Tooltip 
                        cursor={{ fill: isDarkMode ? '#ffffff05' : '#f8fafc' }}
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          borderRadius: '16px',
                          border: 'none',
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}
                      />
                      <Bar dataKey="avgStayHours" radius={[8, 8, 0, 0]} barSize={40}>
                        {consultantStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Volume Pie Chart */}
              <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="mb-8">
                  <h4 className="text-sm font-black uppercase tracking-tight">Distribuição de Volume</h4>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Participação de Saídas por Consultor</p>
                </div>
                <div className="h-80 w-full flex items-center">
                  <div className="flex-1 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={consultantStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="count"
                        >
                          {consultantStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                            borderRadius: '16px',
                            border: 'none',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-3 pr-8 min-w-[200px]">
                    {consultantStats.map((s, idx) => (
                      <div key={s.name} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                          <span className="text-[10px] font-black uppercase">{s.name}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500">{((s.count / consultantStats.reduce((acc, curr) => acc + curr.count, 0)) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Consultant Performance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
              {consultantStats.map((s, idx) => (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-6 rounded-[2.5rem] border group hover:scale-[1.02] transition-all duration-500 ${isDarkMode ? 'bg-[#12141C] border-white/5 hover:bg-blue-600/5 hover:border-blue-500/20' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5'}`}
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-black shadow-lg">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h5 className="text-sm font-black uppercase tracking-tight">{s.name}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1 ${parseInt(s.efficiencyScore as string) > 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                          <i className="fas fa-bolt"></i> Eficiência {s.efficiencyScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-3xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Permanência</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black">{s.avgStayHours}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">hrs/car</span>
                      </div>
                    </div>
                    <div className={`p-4 rounded-3xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Volume</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black">{s.count}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Saídas</span>
                      </div>
                    </div>
                    <div className={`p-4 rounded-3xl col-span-2 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8px] font-black text-slate-500 uppercase">Carga de Pátio Atual</span>
                        <span className="text-[10px] font-black text-blue-600">{s.active} VEÍCULOS</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, (s.active / (vehicles.length || 1)) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : viewMode === 'daily' ? (
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
              <i className="fas fa-list"></i> Cronologia do Dia
            </h4>
            
            {filteredLogs.length === 0 ? (
                <div className={`p-12 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center ${isDarkMode ? 'border-white/5 bg-white/[0.01]' : 'border-slate-100 bg-white'}`}>
                   <i className="fas fa-clipboard-list text-4xl text-slate-300 mb-4"></i>
                   <p className="text-[10px] font-black uppercase text-slate-400">Nenhum evento registrado nesta data</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLogs.map(log => (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={log.id} 
                          className={`p-5 rounded-3xl border transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                                 log.action === 'entry' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 
                                 log.action === 'exit' ? 'bg-slate-900 shadow-lg shadow-slate-900/20 border border-white/20' :
                                 'bg-blue-500'
                               }`}>
                                  <i className={`fas ${log.action === 'entry' ? 'fa-sign-in-alt' : log.action === 'exit' ? 'fa-flag-checkered' : 'fa-info-circle'}`}></i>
                               </div>
                               <span className="text-[9px] font-black text-slate-400 font-mono">{format(new Date(log.timestamp), 'HH:mm')}</span>
                            </div>
                            
                            <div className="flex items-center gap-3 mb-3">
                               <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[11px] font-black border-2" style={{ borderColor: log.prismaColor }}>
                                  {log.prismaNumber}
                               </div>
                               <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{log.vehiclePlate}</span>
                                  <h5 className={`text-xs font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{log.vehicleModel}</h5>
                               </div>
                            </div>
                            
                            <div className="pt-3 border-t border-dashed border-slate-500/10">
                               <p className="text-[10px] font-medium text-slate-500 italic">“{log.details}”</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 pb-12">
             {groupedLogs?.map(({ date, entries, exits, logs }) => (
                <div key={date.toISOString()} className={`p-8 rounded-[3rem] border transition-all ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                   <div className="flex justify-between items-center mb-8 border-b border-dashed border-slate-500/10 pb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-xl font-black">
                            {format(date, 'dd')}
                         </div>
                         <div>
                            <h4 className="text-sm font-black uppercase tracking-tight">{format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}</h4>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Visão Diária Consolidada</p>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-8">
                         <div className="text-right">
                            <span className="block text-[8px] font-black text-emerald-500 uppercase mb-0.5">Entradas</span>
                            <span className="text-lg font-black">{entries}</span>
                         </div>
                         <div className="text-right border-l border-slate-500/10 pl-8">
                            <span className="block text-[8px] font-black text-slate-900 dark:text-white uppercase mb-0.5">Saídas</span>
                            <span className="text-lg font-black">{exits}</span>
                         </div>
                      </div>
                   </div>
                   
                   <div className="space-y-4">
                      {logs.slice(0, 5).map(log => (
                         <div key={log.id} className={`p-4 rounded-2xl flex items-center justify-between transition-all ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                            <div className="flex items-center gap-4">
                               <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] text-white ${log.action === 'entry' ? 'bg-emerald-500' : log.action === 'exit' ? 'bg-slate-900' : 'bg-blue-500'}`}>
                                  <i className={`fas ${log.action === 'entry' ? 'fa-sign-in-alt' : log.action === 'exit' ? 'fa-flag-checkered' : 'fa-info-circle'}`}></i>
                               </div>
                               <div>
                                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mr-2">{log.vehiclePlate}</span>
                                  <span className="text-[9px] font-black uppercase text-slate-400">{log.vehicleModel}</span>
                               </div>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 font-mono">{format(new Date(log.timestamp), 'HH:mm')}</span>
                         </div>
                      ))}
                      {logs.length > 5 && (
                         <button className="w-full py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-colors">
                            Ver mais {logs.length - 5} eventos deste dia
                         </button>
                      )}
                   </div>
                </div>
             ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default OperationsOverview;
