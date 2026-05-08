
import React, { useMemo, useState, useRef } from 'react';
import { Vehicle, ActivityLog } from '../types';
import { motion } from 'motion/react';
import { MAX_SLOTS, CONSULTANTS, ALERT_THRESHOLDS } from '../constants';
import { getYardInsights, getStrategicOptimization, getLayoutAndFlowOptimization, getStrategicOptimizationPro, getYardOptimizationSummary } from '../services/geminiService';
import { analyzeYardEfficiency } from '../services/yardOptimization';
import { toPng } from 'html-to-image';
import Markdown from 'react-markdown';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { isSameDay, isSameMonth, differenceInHours, differenceInMinutes } from 'date-fns';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface YardData {
  name: string;
  count: number;
  maxSlots: number;
}

interface DashboardProps {
  vehicles: Vehicle[];
  activityLogs?: ActivityLog[];
  isDarkMode?: boolean;
  maxSlots: number;
  allYardsData?: YardData[];
  onYardClick?: (yardName: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  vehicles, 
  activityLogs = [], 
  isDarkMode = false, 
  maxSlots, 
  allYardsData = [],
  onYardClick
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [strategicInsights, setStrategicInsights] = useState<string | null>(null);
  const [strategicProInsights, setStrategicProInsights] = useState<string | null>(null);
  const [layoutInsights, setLayoutInsights] = useState<string | null>(null);
  const [optimizationSummary, setOptimizationSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimizingPro, setIsOptimizingPro] = useState(false);
  const [isOptimizingLayout, setIsOptimizingLayout] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  React.useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleGetInsights = async () => {
    setIsGenerating(true);
    const result = await getYardInsights(vehicles);
    setAiInsights(result);
    setIsGenerating(false);
  };

  const handleGetOptimization = async () => {
    setIsOptimizing(true);
    const result = await getStrategicOptimization(vehicles, activityLogs);
    setStrategicInsights(result);
    setIsOptimizing(false);
  };
  
  const handleGetStrategicPro = async () => {
    setIsOptimizingPro(true);
    const result = await getStrategicOptimizationPro(vehicles, activityLogs);
    setStrategicProInsights(result);
    setIsOptimizingPro(false);
  };

  const handleGetLayoutOptimization = async () => {
    setIsOptimizingLayout(true);
    const result = await getLayoutAndFlowOptimization(vehicles, activityLogs, maxSlots);
    setLayoutInsights(result);
    setIsOptimizingLayout(false);
  };

  const handleGetOptimizationSummary = async () => {
    setIsSummarizing(true);
    const result = await getYardOptimizationSummary(vehicles, activityLogs);
    setOptimizationSummary(result);
    setIsSummarizing(false);
  };

  const stats = useMemo(() => {
    const today = new Date();
    
    const todayLogs = activityLogs.filter(log => {
      try {
        return isSameDay(new Date(log.timestamp), today);
      } catch { return false; }
    });

    const monthLogs = activityLogs.filter(log => {
      try {
        return isSameMonth(new Date(log.timestamp), today);
      } catch { return false; }
    });

    const todayEntries = todayLogs.filter(log => log.action === 'entry').length;
    const todayExits = todayLogs.filter(log => log.action === 'exit').length;

    const monthEntries = monthLogs.filter(log => log.action === 'entry').length;
    const monthExits = monthLogs.filter(log => log.action === 'exit').length;

    const hourData = Array.from({ length: 24 }).map((_, hour) => {
      const countAtHour = activityLogs.filter(log => {
        const logTime = new Date(log.timestamp);
        if (!isSameDay(logTime, today)) return false;
        return logTime.getHours() <= hour;
      }).reduce((acc, log) => {
        if (log.action === 'entry') return acc + 1;
        if (log.action === 'exit') return acc - 1;
        return acc;
      }, 0);

      return {
        hour: `${hour}h`,
        count: Math.max(0, countAtHour)
      };
    });

    const topPeaks = [...hourData]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter(p => p.count > 0);

    const healthData = [
      { name: 'Dentro do SLA', value: vehicles.filter(v => differenceInHours(new Date(), new Date(v.entryTime)) < ALERT_THRESHOLDS.WARNING).length, color: '#10b981' },
      { name: 'Alerta SLA', value: vehicles.filter(v => {
        const h = differenceInHours(new Date(), new Date(v.entryTime));
        return h >= ALERT_THRESHOLDS.WARNING && h < ALERT_THRESHOLDS.CRITICAL;
      }).length, color: '#f59e0b' },
      { name: 'Tempo Excedido', value: vehicles.filter(v => {
        return differenceInHours(new Date(), new Date(v.entryTime)) >= ALERT_THRESHOLDS.CRITICAL;
      }).length, color: '#ef4444' }
    ];

    const consultantData = CONSULTANTS.map(name => ({
      name: String(name).split(' ')[0],
      count: vehicles.filter(v => v.consultant === name).length
    })).sort((a, b) => b.count - a.count);

    const yardOccupancyData = allYardsData.map(yard => ({
      name: yard.name,
      count: yard.count,
      maxSlots: yard.maxSlots,
      percentage: yard.maxSlots > 0 ? (yard.count / yard.maxSlots) * 100 : 0
    }));

    const turnoverRate = todayEntries > 0 ? ((todayExits / todayEntries) * 100).toFixed(0) : '0';

    const yardNames = allYardsData.length > 0 ? allYardsData.map(y => y.name) : Array.from(new Set(activityLogs.filter(l => l.yardName).map(l => l.yardName as string)));
    
    const heatmapData = yardNames.map(yardName => {
      const hours = Array.from({ length: 24 }).map((_, hour) => {
        const countAtHour = activityLogs.filter(log => {
          const logTime = new Date(log.timestamp);
          if (!isSameDay(logTime, today)) return false;
          if (log.yardName !== yardName) return false;
          return logTime.getHours() <= hour;
        }).reduce((acc, log) => {
          if (log.action === 'entry') return acc + 1;
          if (log.action === 'exit') return acc - 1;
          return acc;
        }, 0);
        return Math.max(0, countAtHour);
      });
      return { yardName, hours };
    });

    const efficiency = analyzeYardEfficiency(vehicles);

    // Filter critical relocations based on P6 capacity
    const p6Data = allYardsData.find(y => y.id === 'yardP6' || y.name === 'Pátio P6');
    const hasP6Space = p6Data ? p6Data.count < p6Data.maxSlots : true;
    
    if (!hasP6Space) {
      efficiency.criticalRelocations = [];
    }

    return { 
      occupiedCount: vehicles.length, 
      consultantData, 
      yardOccupancyData,
      healthData, 
      todayEntries, 
      todayExits, 
      monthEntries,
      monthExits,
      hourData,
      topPeaks,
      turnoverRate,
      heatmapData,
      efficiency,
      activeKeysCount: vehicles.length
    };
  }, [vehicles, activityLogs, allYardsData]);

  const handleExportCSV = () => {
    const headers = ['Placa', 'Modelo', 'Cliente', 'Consultor', 'Tempo de Permanência', 'Status'];
    const rows = vehicles.map(v => {
      const entryDate = new Date(v.entryTime);
      const totalMinutes = differenceInMinutes(new Date(), entryDate);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const stayTime = `${hours}h ${minutes}m`;
      
      return [
        v.plate,
        v.model,
        v.customer,
        v.consultant,
        stayTime,
        v.washStatus
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_patio_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadOccupancyPNG = async () => {
    if (chartRef.current === null) return;
    
    try {
      const dataUrl = await toPng(chartRef.current, { cacheBust: true, backgroundColor: isDarkMode ? '#12141C' : '#ffffff' });
      const link = document.createElement('a');
      link.download = `grafico_ocupacao_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar PNG:', err);
    }
  };

  return (
    <div className={`flex flex-col gap-4 sm:gap-6 h-full overflow-y-auto custom-scrollbar transition-colors duration-700 p-4 sm:p-6 md:p-8 print:h-auto print:overflow-visible print:p-0 ${isDarkMode ? 'bg-[#07080C]' : 'bg-[#F9FAFB]'}`}>
      
      {/* 1. Header de Status Crítico */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border flex items-center justify-between gap-4 sm:gap-6 transition-all ${isDarkMode ? 'bg-red-500/5 border-red-500/20 shadow-[0_0_30px_rgba(239,68,44,0.05)]' : 'bg-red-50 border-red-100'}`}>
           <div className="flex items-center gap-4 sm:gap-6">
              <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-lg ${stats.healthData[2].value > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}>
                 <i className={`fas ${stats.healthData[2].value > 0 ? 'fa-exclamation-triangle' : 'fa-check-circle'} text-xl md:text-2xl`}></i>
              </div>
              <div>
                 <h3 className={`text-lg md:text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats.healthData[2].value} Críticos / {stats.occupiedCount} Ativos</h3>
                 <p className="text-slate-500 text-[10px] md:text-sm font-medium uppercase tracking-widest">Estado da Operação</p>
              </div>
           </div>
        </div>

        <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border flex items-center justify-between gap-4 sm:gap-6 transition-all ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'bg-emerald-50 border-emerald-100'}`}>
           <div className="flex items-center gap-4 sm:gap-6">
              <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-lg ${vehicles.some(v => v.washStatus === 'Veículo Pronto') ? 'bg-emerald-500 animate-bounce' : 'bg-slate-500'}`}>
                 <i className="fas fa-flag-checkered text-xl md:text-2xl"></i>
              </div>
              <div>
                 <h3 className={`text-lg md:text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{vehicles.filter(v => v.washStatus === 'Veículo Pronto').length} Prontos</h3>
                 <p className="text-slate-500 text-[10px] md:text-sm font-medium uppercase tracking-widest">Aguardando Liberação</p>
              </div>
           </div>
        </div>

        <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border flex items-center justify-between gap-4 sm:gap-6 transition-all ${isDarkMode ? 'bg-blue-500/5 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.05)]' : 'bg-blue-50 border-blue-100'}`}>
           <div className="flex items-center gap-4 sm:gap-6">
              <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-lg ${stats.efficiency.efficiencyScore >= 80 ? 'bg-blue-500' : 'bg-amber-500 animate-pulse'}`}>
                 <i className="fas fa-route text-xl md:text-2xl"></i>
              </div>
              <div>
                 <h3 className={`text-lg md:text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats.efficiency.efficiencyScore}% Eficiência</h3>
                 <p className="text-slate-500 text-[10px] md:text-sm font-medium uppercase tracking-widest">Fluxo de Logística</p>
              </div>
           </div>
        </div>

        <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border flex items-center justify-between gap-4 sm:gap-6 transition-all ${isDarkMode ? 'bg-violet-500/5 border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.05)]' : 'bg-violet-50 border-violet-100'}`}>
           <div className="flex items-center gap-4 sm:gap-6">
              <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-violet-600 flex items-center justify-center text-white shadow-lg`}>
                 <i className="fas fa-key text-xl md:text-2xl"></i>
              </div>
              <div>
                 <h3 className={`text-lg md:text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stats.activeKeysCount} Chaves Ativas</h3>
                 <p className="text-slate-500 text-[10px] md:text-sm font-medium uppercase tracking-widest">Controle de Localização</p>
              </div>
           </div>
        </div>
      </div>

      {/* 1.1 Lista de Veículos Aguardando Liberação */}
      {vehicles.some(v => v.washStatus === 'Veículo Pronto') && (
        <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border transition-all ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <i className="fas fa-truck-loading"></i>
            </div>
            <div>
              <h4 className={`text-xs sm:text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Veículos Aguardando Liberação</h4>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight">Vagas para novos atendimentos</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {vehicles.filter(v => v.washStatus === 'Veículo Pronto').map(v => (
              <div key={v.id} className={`p-4 rounded-2xl border flex items-center gap-4 transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-md border-2" style={{ borderColor: v.prisma.color }}>
                  {v.prisma.number}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{v.plate}</span>
                  <h5 className={`text-xs font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{v.model}</h5>
                  <span className="text-[9px] font-bold text-emerald-500 uppercase">Vaga {v.slotIndex + 1} • {v.consultant.split(' ')[0]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1.2 Sugestões de Realocação (Otimização de Fluxo) */}
      {(stats.efficiency.misplacedVehicles.length > 0 || stats.efficiency.criticalRelocations.length > 0) && (
        <div className="flex flex-col gap-6">
          {stats.efficiency.criticalRelocations.length > 0 && (
            <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border transition-all ${isDarkMode ? 'bg-red-500/[0.03] border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.05)]' : 'bg-red-50/50 border-red-100 shadow-sm'}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                    <i className="fas fa-exclamation-circle text-xs sm:text-base"></i>
                  </div>
                  <div>
                    <h4 className={`text-xs sm:text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Realocação de Longa Permanência</h4>
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight">Liberar vagas produtivas (Setor P6)</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-red-600/10 rounded-full">
                  <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Estadia &gt; 48h</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {stats.efficiency.criticalRelocations.map(v => (
                  <div key={v.vehicleId} className={`p-5 rounded-2xl border flex items-center gap-4 transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-red-200'}`}>
                    <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-lg shadow-inner">
                      <i className="fas fa-long-arrow-alt-right"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h5 className={`text-xs font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{v.model}</h5>
                        <span className="text-[10px] font-black font-mono text-red-500">{v.stayHours}h</span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">
                        De: <span className="text-slate-400">{v.currentYard === 'yard' ? 'Sub Solo' : v.currentYard.replace('yard', 'Pátio ')}</span> 
                        <i className="fas fa-chevron-right mx-2 text-[7px]"></i>
                        Para: <span className="text-blue-600 font-black">Setor P6</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: '100%' }}></div>
                        </div>
                        <span className="text-[8px] font-black text-red-500 uppercase">Prioridade Máxima</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.efficiency.misplacedVehicles.length > 0 && (
            <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border transition-all ${isDarkMode ? 'bg-blue-500/[0.03] border-blue-500/10' : 'bg-blue-50/50 border-blue-100 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <i className="fas fa-route text-xs sm:text-base"></i>
                </div>
                <div>
                  <h4 className={`text-xs sm:text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Sugestões de Realocação</h4>
                  <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">Otimizar pátio por serviço</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {stats.efficiency.misplacedVehicles.slice(0, 6).map(v => (
                  <div key={v.id} className={`p-4 rounded-2xl border flex items-center gap-4 transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-blue-200'}`}>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xs shadow-inner">
                      <i className="fas fa-exchange-alt"></i>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h5 className={`text-xs font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{v.model}</h5>
                      <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                        Mover para: <span className="text-blue-600">
                          {stats.efficiency.recommendations.find(r => r.vehicleId === v.id)?.suggestedYards.map(y => 
                            y === 'yard' ? 'Sub Solo' : y.replace('yard', 'Pátio ')
                          ).join(', ')}
                        </span>
                      </p>
                      <span className="text-[8px] font-black italic text-slate-400 mt-1 uppercase tracking-tighter">Serviço: {v.service}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Optimized Yard Occupancy Chart */}
      <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border shadow-xl transition-all ${isDarkMode ? 'bg-[#12141C] border-white/5 shadow-blue-900/5' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
              <i className="fas fa-chart-bar text-lg"></i>
            </div>
            <div>
              <h3 className={`text-sm sm:text-base font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Monitor de Capacidade Operacional</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Ocupação vs. Limite Técnico por Pátio</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 no-print bg-slate-500/5 p-2 rounded-2xl border border-white/5">
            <div className="flex items-center gap-6 px-4 py-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white/20"></div>
                <span className="text-[9px] font-black text-slate-500 uppercase">Ideal (&lt;60%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white/20"></div>
                <span className="text-[9px] font-black text-slate-500 uppercase">Alerta (60-90%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white/20"></div>
                <span className="text-[9px] font-black text-slate-500 uppercase">Crítico (&gt;90%)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <button 
                onClick={handleDownloadOccupancyPNG}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm'}`}
              >
                <i className="fas fa-download text-xs text-blue-500"></i>
                PNG
              </button>
            </div>
          </div>
        </div>

        <div ref={chartRef} className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.yardOccupancyData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
              <defs>
                <linearGradient id="capacityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isDarkMode ? "#ffffff" : "#000000"} stopOpacity={0.08}/>
                  <stop offset="95%" stopColor={isDarkMode ? "#ffffff" : "#000000"} stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#ffffff08" : "#00000008"} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
                interval={0}
                angle={-45}
                textAnchor="end"
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} 
              />
              <Tooltip 
                cursor={{ fill: isDarkMode ? '#ffffff05' : '#f1f5f9' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const statusColor = data.percentage >= 90 ? '#ef4444' : data.percentage >= 60 ? '#f59e0b' : '#10b981';
                    return (
                      <div className={`p-5 rounded-[1.5rem] shadow-2xl border-2 backdrop-blur-2xl ${isDarkMode ? 'bg-[#0f172a]/95 border-white/10 text-white' : 'bg-white/95 border-slate-100 text-slate-900'}`}>
                        <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs" style={{ backgroundColor: statusColor }}>
                            <i className="fas fa-warehouse"></i>
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-widest">{data.name}</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center gap-12">
                            <span className="text-[9px] font-black uppercase text-slate-500">Ocupados</span>
                            <span className="text-sm font-black font-mono text-blue-500">{data.count}</span>
                          </div>
                          <div className="flex justify-between items-center gap-12">
                            <span className="text-[9px] font-black uppercase text-slate-500">Capacidade</span>
                            <span className="text-sm font-black font-mono text-slate-400">{data.maxSlots}</span>
                          </div>
                          <div className="flex justify-between items-center gap-12 pt-3 border-t border-white/5">
                            <span className="text-[9px] font-black uppercase text-slate-500">Ocupação</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-slate-500/20 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${data.percentage}%`, backgroundColor: statusColor }}></div>
                              </div>
                              <span className="text-[11px] font-black font-mono" style={{ color: statusColor }}>
                                {data.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="maxSlots" 
                name="Capacidade"
                fill="url(#capacityGradient)"
                radius={[8, 8, 0, 0]} 
                barSize={32} 
                isAnimationActive={true}
              />
              <Bar 
                dataKey="count" 
                name="Veículos"
                radius={[8, 8, 0, 0]} 
                barSize={32}
                isAnimationActive={true}
                animationDuration={1500}
                style={{ cursor: onYardClick ? 'pointer' : 'default' }}
                onClick={(data) => {
                  if (onYardClick && data && data.name) {
                    onYardClick(data.name);
                  }
                }}
              >
                {stats.yardOccupancyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.percentage >= 90 ? '#ef4444' : entry.percentage >= 60 ? '#f59e0b' : '#10b981'} 
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-8 flex justify-center gap-8 no-print">
          <div className="flex flex-col items-center gap-1">
             <div className="w-32 h-1 rounded-full bg-slate-500/10 overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '100%' }}></div>
             </div>
             <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Barras de Capacidade</span>
          </div>
          <div className="flex flex-col items-center gap-1">
             <div className="w-32 h-1 rounded-full bg-slate-500/10 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: '40%' }}></div>
             </div>
             <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Ocupação Atual</span>
          </div>
        </div>
      </div>


      {/* 2.1 Porcentagem de Ocupação por Pátio */}
      <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border shadow-sm transition-colors ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <i className="fas fa-percent text-base"></i>
          </div>
          <div>
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Comparativo de Ocupação (%)</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Percentual de Lotação por Setor</p>
          </div>
        </div>
        
        <div className="h-[240px] sm:h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={stats.yardOccupancyData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDarkMode ? "#ffffff05" : "#00000005"} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} 
                width={100}
              />
              <Tooltip 
                cursor={{ fill: isDarkMode ? '#ffffff05' : '#f8fafc' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className={`p-3 rounded-xl shadow-xl border backdrop-blur-xl ${isDarkMode ? 'bg-[#1e293b]/90 border-white/10 text-white' : 'bg-white/90 border-slate-200 text-slate-900'}`}>
                        <p className="text-[10px] font-black uppercase mb-1">{data.name}</p>
                        <p className={`text-sm font-black ${data.percentage >= 90 ? 'text-red-500' : data.percentage >= 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {data.percentage.toFixed(1)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="percentage" 
                radius={[0, 10, 10, 0]} 
                barSize={24}
                isAnimationActive={false}
              >
                {stats.yardOccupancyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.percentage >= 90 ? '#ef4444' : entry.percentage >= 60 ? '#f59e0b' : '#10b981'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2.2 Heatmap de Densidade */}
      <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border shadow-sm transition-colors ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <i className="fas fa-th text-base"></i>
          </div>
          <div>
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Densidade de Veículos (Hoje)</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Mapa de Calor por Setor e Horário</p>
          </div>
        </div>
        
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <div className="min-w-[800px]">
             {/* Header Horas */}
             <div className="flex mb-2">
                <div className="w-24 shrink-0"></div>
                <div className="flex-1 flex justify-between px-2">
                   {Array.from({ length: 24 }).map((_, i) => (
                      <span key={i} className="text-[8px] font-black text-slate-400 w-6 text-center">{i}h</span>
                   ))}
                </div>
             </div>
             
             {/* Grid */}
             <div className="flex flex-col gap-1">
                {stats.heatmapData.map((yard, yIdx) => (
                   <div key={yIdx} className="flex items-center">
                      <div className="w-24 shrink-0 pr-4">
                         <span className={`text-[9px] font-black uppercase truncate block ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{yard.yardName}</span>
                      </div>
                      <div className="flex-1 flex justify-between gap-1 px-1">
                         {yard.hours.map((count, hIdx) => {
                            const opacity = count > 0 ? 0.1 + (count * 0.15) : 0.05;
                            return (
                               <motion.div
                                  key={hIdx}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: (yIdx * 0.03) + (hIdx * 0.005) }}
                                  className={`h-8 flex-1 rounded-sm relative group cursor-help`}
                                  style={{ 
                                     backgroundColor: count > 0 ? (isDarkMode ? `rgba(59, 130, 246, ${Math.min(0.9, opacity)})` : `rgba(37, 99, 235, ${Math.min(0.9, opacity)})`) : (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                                  }}
                               >
                                  {count > 0 && (
                                     <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] font-black text-white drop-shadow-md">{count}</span>
                                     </div>
                                  )}
                                  {/* Simple Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-[60] transition-opacity shadow-xl">
                                     {yard.yardName} • {hIdx}:00 • {count} veículo(s)
                                  </div>
                               </motion.div>
                            );
                         })}
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
        
        <div className="mt-6 flex items-center justify-end gap-4">
           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-[9px]">Menos</span>
           <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-white/5"></div>
              <div className="w-3 h-3 rounded-sm bg-blue-500/20"></div>
              <div className="w-3 h-3 rounded-sm bg-blue-500/40"></div>
              <div className="w-3 h-3 rounded-sm bg-blue-500/60"></div>
              <div className="w-3 h-3 rounded-sm bg-blue-500/80"></div>
              <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
           </div>
           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-[9px]">Mais</span>
        </div>
      </div>

      {/* 3. AI ADVISOR PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Quick Optimization Summary */}
        <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border transition-all relative overflow-hidden ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full animate-pulse-subtle"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <i className="fas fa-bolt"></i>
              </div>
              <div>
                <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Resumo de Otimização</h4>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight">Insights Rápidos via IA</p>
              </div>
            </div>
            <button 
              onClick={handleGetOptimizationSummary}
              disabled={isSummarizing || hasApiKey === false}
              className={`no-print px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isSummarizing || hasApiKey === false ? 'bg-slate-500 opacity-50' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'} text-white`}
            >
              {isSummarizing ? <><i className="fas fa-spinner fa-spin mr-2"></i> Sumarizando...</> : <><i className="fas fa-magic mr-2"></i> Gerar Resumo</>}
            </button>
          </div>

          {optimizationSummary ? (
            <div className={`p-5 rounded-2xl border animate-card-fade-in ${isDarkMode ? 'bg-[#161922] border-white/5 text-slate-300' : 'bg-white border-emerald-100 text-slate-700 shadow-sm'}`}>
              <div className={`markdown-body ${isDarkMode ? 'prose-invert' : ''} text-[11px] leading-relaxed`}>
                <Markdown>{optimizationSummary}</Markdown>
              </div>
            </div>
          ) : (
            <div className="no-print py-8 flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/10 rounded-[2rem]">
               <h5 className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Aguardando Solicitação</h5>
            </div>
          )}
        </div>

        {/* Existing Tactic Advisor */}
        <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border transition-all relative overflow-hidden ${isDarkMode ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full animate-pulse-subtle"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                <i className="fas fa-robot"></i>
              </div>
              <div>
                <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>AI Strategy Advisor</h4>
                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">Recomendações Táticas</p>
              </div>
            </div>
            <button 
              onClick={handleGetInsights}
              disabled={isGenerating || hasApiKey === false}
              className={`no-print px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isGenerating || hasApiKey === false ? 'bg-slate-500 opacity-50' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'} text-white`}
            >
              {isGenerating ? <><i className="fas fa-spinner fa-spin mr-2"></i> Analisando...</> : <><i className="fas fa-brain mr-2"></i> Gerar Tática</>}
            </button>
          </div>

          {aiInsights ? (
            <div className={`p-5 rounded-2xl border animate-card-fade-in ${isDarkMode ? 'bg-[#161922] border-white/5 text-slate-300' : 'bg-white border-blue-100 text-slate-700 shadow-sm'}`}>
              <p className="whitespace-pre-line text-[11px] font-medium leading-relaxed">{aiInsights}</p>
            </div>
          ) : (
            <div className="no-print py-8 flex flex-col items-center justify-center border-2 border-dashed border-blue-500/10 rounded-[2rem]">
               <h5 className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Aguardando Solicitação</h5>
            </div>
          )}
        </div>
      </div>

      {/* 3.1 COMPREHENSIVE STRATEGIC OPTIMIZATION PANEL */}
      <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border transition-all relative overflow-hidden ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100 shadow-sm'}`}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-bl-full animate-pulse-subtle"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <i className="fas fa-microchip text-xl"></i>
            </div>
            <div>
              <h4 className={`text-base font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Sugestões de Otimização Estratégica</h4>
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-tight">Análise Avançada de Realocação, Fluxo e Layout</p>
            </div>
          </div>
          
          <button 
            onClick={handleGetStrategicPro}
            disabled={isOptimizingPro || hasApiKey === false}
            className={`no-print px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${isOptimizingPro || hasApiKey === false ? 'bg-slate-500 opacity-50' : 'bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-500/30'} text-white flex items-center gap-3`}
          >
            {isOptimizingPro ? <><i className="fas fa-spinner fa-spin"></i> Otimizando...</> : <><i className="fas fa-sparkles"></i> Gerar Recomendações</>}
          </button>
        </div>
        
        {strategicProInsights ? (
          <div className={`p-8 rounded-[2rem] border animate-card-fade-in ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-indigo-100 shadow-inner'}`}>
             <div className={`markdown-body ${isDarkMode ? 'prose-invert' : ''} text-xs leading-relaxed`}>
                <Markdown>{strategicProInsights}</Markdown>
             </div>
             <div className="mt-8 pt-6 border-t border-dashed border-indigo-500/10 flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase">Consultoria de IA • YardLogic Pro</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(strategicProInsights);
                    alert('Recomendações copiadas!');
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-500 text-[9px] font-black uppercase hover:bg-indigo-500 hover:text-white transition-all"
                >
                  <i className="fas fa-copy mr-2"></i> Copiar
                </button>
             </div>
          </div>
        ) : (
          <div className="no-print py-12 flex flex-col items-center justify-center border-2 border-dashed border-indigo-500/10 rounded-[2.5rem]">
             <div className="w-16 h-16 rounded-full bg-indigo-500/5 flex items-center justify-center text-indigo-500/30 mb-4">
                <i className="fas fa-brain-circuit text-3xl"></i>
             </div>
             <h5 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>IA Pronta para Análise</h5>
             <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Acione o botão para otimizar a logística do pátio</p>
          </div>
        )}
      </div>

      {/* 3. STRATEGIC OPTIMIZATION PANEL */}
      <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border transition-all relative overflow-hidden ${isDarkMode ? 'bg-purple-500/5 border-purple-500/20' : 'bg-purple-50 border-purple-100'}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full animate-pulse-subtle"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <i className="fas fa-chess-knight"></i>
            </div>
            <div>
              <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Otimização Estratégica</h4>
              <p className="text-[10px] text-purple-500 font-bold uppercase tracking-tight">Layout Setorial & Fluxo de Trabalho Porsche</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {hasApiKey === false && (
              <button 
                onClick={handleOpenKeyDialog}
                className="no-print px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-purple-100 text-purple-600 border border-purple-200 hover:bg-purple-200"
              >
                <i className="fas fa-key mr-2"></i> Configurar API Key
              </button>
            )}
            <button 
              onClick={handleGetOptimization}
              disabled={isOptimizing || hasApiKey === false}
              className={`no-print px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isOptimizing || hasApiKey === false ? 'bg-slate-500 opacity-50' : 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20'} text-white`}
            >
              {isOptimizing ? <><i className="fas fa-spinner fa-spin mr-2"></i> Otimizando...</> : <><i className="fas fa-wand-magic-sparkles mr-2"></i> Otimizar Layout</>}
            </button>
          </div>
        </div>

        {strategicInsights ? (
          <div className={`p-6 rounded-2xl border leading-relaxed animate-card-fade-in ${isDarkMode ? 'bg-[#161922] border-white/5 text-slate-300' : 'bg-white border-purple-100 text-slate-700'}`}>
            <div className="flex flex-col gap-4">
              {strategicInsights.split('\n\n').map((para, idx) => (
                <div key={idx} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0 mt-0.5">
                    <span className="text-[10px] font-black">{idx + 1}</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed">{para}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-dashed border-purple-500/10 flex justify-end">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(strategicInsights);
                  alert('Recomendações copiadas para o clipboard!');
                }}
                className="text-[9px] font-black uppercase text-purple-500 hover:text-purple-400 transition-colors"
              >
                <i className="fas fa-copy mr-1"></i> Copiar Estratégia
              </button>
            </div>
          </div>
        ) : (
          <div className="no-print text-center py-6 border-2 border-dashed border-purple-500/10 rounded-2xl">
            <i className="fas fa-brain-circuit text-purple-500/20 text-3xl mb-3 block"></i>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {hasApiKey === false ? 'Selecione uma API Key Pro para habilitar a otimização estratégica' : 'Analise o layout setorial e fluxo de trabalho com IA'}
            </p>
          </div>
        )}
      </div>

      {/* 4. LAYOUT & FLOW OPTIMIZATION PANEL */}
      <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border transition-all relative overflow-hidden ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full animate-pulse-subtle"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <i className="fas fa-route"></i>
            </div>
            <div>
              <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Otimização de Layout e Fluxo</h4>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight">Alocação de Vagas & Rotas de Movimentação</p>
            </div>
          </div>
          
          <button 
            onClick={handleGetLayoutOptimization}
            disabled={isOptimizingLayout || hasApiKey === false}
            className={`no-print px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isOptimizingLayout || hasApiKey === false ? 'bg-slate-500 opacity-50' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'} text-white`}
          >
            {isOptimizingLayout ? <><i className="fas fa-spinner fa-spin mr-2"></i> Analisando Layout...</> : <><i className="fas fa-map-marked-alt mr-2"></i> Analisar Layout</>}
          </button>
        </div>

        {layoutInsights ? (
          <div className={`p-6 rounded-2xl border leading-relaxed animate-card-fade-in ${isDarkMode ? 'bg-[#161922] border-white/5 text-slate-300' : 'bg-white border-emerald-100 text-slate-700'}`}>
            <div className="flex flex-col gap-6">
              {layoutInsights.split('\n\n').map((section, idx) => {
                const lines = section.split('\n');
                const title = lines[0];
                const content = lines.slice(1).join('\n');
                
                return (
                  <div key={idx} className="flex flex-col gap-2">
                    <h5 className="text-[11px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      {title.replace(/^[0-9*#. ]+/, '')}
                    </h5>
                    <p className="text-xs font-medium leading-relaxed pl-3.5 border-l border-emerald-500/20">{content || title}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-dashed border-emerald-500/10 flex justify-end">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(layoutInsights);
                  alert('Análise de layout copiada para o clipboard!');
                }}
                className="text-[9px] font-black uppercase text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                <i className="fas fa-copy mr-1"></i> Copiar Análise
              </button>
            </div>
          </div>
        ) : (
          <div className="no-print text-center py-6 border-2 border-dashed border-emerald-500/10 rounded-2xl">
            <i className="fas fa-draw-polygon text-emerald-500/20 text-3xl mb-3 block"></i>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {hasApiKey === false ? 'Selecione uma API Key Pro para habilitar a análise de layout' : 'Gere sugestões de alocação de vagas e rotas otimizadas'}
            </p>
          </div>
        )}
      </div>

      <div className={`p-10 rounded-[3rem] border shadow-sm transition-all ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100'}`}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <i className="fas fa-chart-line text-lg"></i>
            </div>
            <div>
              <h3 className={`text-lg font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Performance de Fluxo</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Visão Analítica: Hoje vs Mês Atual</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleExportCSV}
              className={`no-print px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${isDarkMode ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-600/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}
            >
              <i className="fas fa-file-csv"></i>
              Exportar CSV
            </button>
            <button 
              onClick={() => window.print()}
              className={`no-print px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'}`}
            >
              <i className="fas fa-print"></i>
              Imprimir Relatório
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3 flex flex-col gap-4">
            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] border-l-4 border-blue-500 pl-3 mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Hoje</h4>
            <div className={`p-6 rounded-[2rem] border relative overflow-hidden group ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Entradas</span>
              <span className="text-3xl font-black text-emerald-500">{stats.todayEntries}</span>
              <i className="fas fa-arrow-down absolute -right-2 -bottom-2 text-emerald-500/10 text-6xl rotate-12"></i>
            </div>
            <div className={`p-6 rounded-[2rem] border relative overflow-hidden group ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Saídas</span>
              <span className="text-3xl font-black text-blue-500">{stats.todayExits}</span>
              <i className="fas fa-arrow-up absolute -right-2 -bottom-2 text-blue-500/10 text-6xl -rotate-12"></i>
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-4">
            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] border-l-4 border-purple-500 pl-3 mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Este Mês</h4>
            <div className={`p-6 rounded-[2rem] border relative overflow-hidden group ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Entradas</span>
              <span className="text-3xl font-black text-emerald-600">{stats.monthEntries}</span>
            </div>
            <div className={`p-6 rounded-[2rem] border relative overflow-hidden group ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Saídas</span>
              <span className="text-3xl font-black text-purple-500">{stats.monthExits}</span>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col">
            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}> Fluxo de Ocupação (Hoje)</h4>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.hourData}>
                  <defs>
                    <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#ffffff05" : "#00000005"} />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
                      borderRadius: '1.2rem', 
                      border: 'none', 
                      boxShadow: '0 20px 40px rgba(0,0,0,0.2)' 
                    }}
                    itemStyle={{ fontSize: '11px', fontWeight: '900', color: '#3b82f6', textTransform: 'uppercase' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorFlow)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <h4 className={`text-[10px] font-black uppercase tracking-widest text-center py-2 border-b-2 border-dashed ${isDarkMode ? 'text-white border-white/5' : 'text-slate-800 border-slate-100'}`}>
              <i className="fas fa-fire-alt mr-2 text-orange-500"></i> Picos do Dia
            </h4>
            <div className="flex flex-col gap-3">
              {stats.topPeaks.length > 0 ? stats.topPeaks.map((peak, idx) => (
                <div key={idx} className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black text-white ${idx === 0 ? 'bg-red-500' : 'bg-slate-500'}`}>
                      {idx + 1}
                    </span>
                    <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{peak.hour}</span>
                  </div>
                  <span className="text-[10px] font-black text-blue-500">{peak.count} v.</span>
                </div>
              )) : (
                <div className="text-center py-6 opacity-20">
                  <p className="text-[8px] font-black uppercase tracking-widest">Sem Picos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className={`xl:col-span-1 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border shadow-sm flex flex-col items-center transition-colors ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100'}`}>
           <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-8 self-start ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Distribuição de SLA</h3>
           <div className="h-[200px] w-full relative">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={stats.healthData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                   {stats.healthData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                 </Pie>
                 <Tooltip />
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stats.occupiedCount}</span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Veículos</span>
             </div>
           </div>
           <div className="w-full mt-6 space-y-3">
             {stats.healthData.map((h, i) => (
               <div key={i} className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color }}></div>
                   <span className="text-[9px] font-black text-slate-500 uppercase">{h.name}</span>
                 </div>
                 <span className={`text-[9px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{h.value}</span>
               </div>
             ))}
           </div>
        </div>

        <div className={`xl:col-span-2 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border shadow-sm transition-colors ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className="flex justify-between items-center mb-8">
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Carga de Trabalho / Consultor</h3>
            <span className="text-[9px] font-black text-blue-500 uppercase">Ordenado por Ativos</span>
          </div>
          <div className="h-[280px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.consultantData} layout="vertical" margin={{ left: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDarkMode ? "#ffffff10" : "#00000005"} />
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} width={80} />
                 <Tooltip cursor={{ fill: isDarkMode ? '#ffffff05' : '#f8fafc' }} />
                 <Bar dataKey="count" fill={isDarkMode ? '#3b82f6' : '#1e293b'} radius={[0, 10, 10, 0]} barSize={24} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        <div className={`xl:col-span-1 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2.8rem] border shadow-sm flex flex-col justify-between transition-colors ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100'}`}>
          <div>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Vagas Livres</h3>
            <div className="p-8 rounded-[2rem] bg-blue-600 flex flex-col items-center justify-center text-white shadow-xl shadow-blue-500/30">
              <span className="text-5xl font-black">{MAX_SLOTS - stats.occupiedCount}</span>
              <span className="text-[10px] font-black uppercase tracking-widest mt-2">Disponíveis</span>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-500/10 text-center">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Pátio operando em conformidade com as diretrizes de giro de ativos.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
