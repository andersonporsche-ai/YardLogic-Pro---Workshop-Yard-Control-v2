
import React, { useState, useEffect, useMemo } from 'react';
import { databaseService } from '../services/database';
import { Vehicle } from '../types';
import { ALERT_THRESHOLDS } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  format, 
  subDays, 
  subWeeks, 
  subMonths, 
  isSameDay, 
  isSameWeek, 
  isSameMonth, 
  addHours, 
  differenceInHours,
  startOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CriticalCasesReportProps {
  isDarkMode?: boolean;
}

type PeriodType = 'day' | 'week' | 'month';

const CriticalCasesReport: React.FC<CriticalCasesReportProps> = ({ isDarkMode = false }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('day');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const all = await databaseService.getAllVehicles();
        setVehicles(all);
      } catch (error) {
        console.error('Error fetching vehicles for report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const criticalCasesData = useMemo(() => {
    // A case is critical if it stayed > 100h
    // becameCriticalAt = entryTime + 100h
    
    const processed = vehicles.map(v => {
      const entry = new Date(v.entryTime);
      const exit = v.exitTime ? new Date(v.exitTime) : new Date();
      const stayHours = differenceInHours(exit, entry);
      const isCritical = stayHours >= ALERT_THRESHOLDS.CRITICAL;
      const becameCriticalAt = isCritical ? addHours(entry, ALERT_THRESHOLDS.CRITICAL) : null;
      
      return {
        ...v,
        isCritical,
        becameCriticalAt,
        stayHours
      };
    }).filter(v => v.isCritical);

    const now = new Date();
    
    if (period === 'day') {
      // Last 14 days
      return Array.from({ length: 14 }).map((_, i) => {
        const date = subDays(now, 13 - i);
        const count = processed.filter(v => v.becameCriticalAt && isSameDay(v.becameCriticalAt, date)).length;
        return {
          label: format(date, 'dd/MM', { locale: ptBR }),
          count,
          fullDate: format(date, 'PPPP', { locale: ptBR })
        };
      });
    } else if (period === 'week') {
      // Last 8 weeks
      return Array.from({ length: 8 }).map((_, i) => {
        const date = subWeeks(now, 7 - i);
        const count = processed.filter(v => v.becameCriticalAt && isSameWeek(v.becameCriticalAt, date, { weekStartsOn: 1 })).length;
        return {
          label: `Semana ${format(date, 'w', { locale: ptBR })}`,
          count,
          fullDate: `Semana de ${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd/MM')} a ${format(addHours(startOfWeek(date, { weekStartsOn: 1 }), 24 * 6 + 23), 'dd/MM')}`
        };
      });
    } else {
      // Last 6 months
      return Array.from({ length: 6 }).map((_, i) => {
        const date = subMonths(now, 5 - i);
        const count = processed.filter(v => v.becameCriticalAt && isSameMonth(v.becameCriticalAt, date)).length;
        return {
          label: format(date, 'MMM', { locale: ptBR }),
          count,
          fullDate: format(date, 'MMMM yyyy', { locale: ptBR })
        };
      });
    }
  }, [vehicles, period]);

  const summary = useMemo(() => {
    const criticals = vehicles.filter(v => {
      const entry = new Date(v.entryTime);
      const exit = v.exitTime ? new Date(v.exitTime) : new Date();
      return differenceInHours(exit, entry) >= ALERT_THRESHOLDS.CRITICAL;
    });

    const activeCriticals = criticals.filter(v => !v.exitTime).length;
    const resolvedCriticals = criticals.filter(v => v.exitTime).length;

    return {
      total: criticals.length,
      active: activeCriticals,
      resolved: resolvedCriticals,
      allCriticals: criticals
    };
  }, [vehicles]);

  const generatePDF = () => {
    const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
    const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR });

    // Header Implementation
    doc.setFillColor(10, 11, 16);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('YardLogic Pro', 20, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RELATÓRIO DE CASOS CRÍTICOS (SLA > 48H)', 20, 28);
    doc.text(`Gerado em: ${timestamp}`, 140, 28);

    // Filter summary
    doc.setTextColor(10, 11, 16);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo de Indicadores', 20, 55);

    autoTable(doc, {
      startY: 60,
      head: [['Métrica', 'Volume']],
      body: [
        ['Total Histórico de Críticos', summary.total.toString()],
        ['Veículos Ativos Excedendo SLA', summary.active.toString()],
        ['Veículos Resolvidos / Com Saída', summary.resolved.toString()]
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Detail Table
    doc.text('Detalhamento de Veículos Críticos', 20, doc.lastAutoTable.finalY + 15);

    const sortedVehicles = [...summary.allCriticals]
      .map(v => {
        const entry = new Date(v.entryTime);
        const exit = v.exitTime ? new Date(v.exitTime) : new Date();
        return { ...v, stayHours: differenceInHours(exit, entry) };
      })
      .sort((a, b) => b.stayHours - a.stayHours);

    const tableData = sortedVehicles.map(v => [
      v.prisma.number,
      v.model,
      v.plate,
      v.consultant,
      `${v.stayHours}h`,
      v.yardId === 'yard' ? 'Sub Solo' : v.yardId.replace('yard', 'Pátio '),
      v.exitTime ? 'Resolvido' : 'Em Pátio'
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Prisma', 'Modelo', 'Placa', 'Consultor', 'Permanência', 'Pátio', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [10, 11, 16] },
      columnStyles: {
        4: { fontStyle: 'bold', textColor: [220, 38, 38] }
      }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount} - Relatório de Casos Críticos - Confidencial`, 105, 290, { align: 'center' });
    }

    doc.save(`Relatorio_Criticos_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`p-6 flex flex-col gap-8 h-full overflow-y-auto ${isDarkMode ? 'bg-transparent text-white' : 'bg-transparent text-slate-900'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter">Relatório de Casos Críticos</h2>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
            Monitoramento de permanências superiores a {ALERT_THRESHOLDS.CRITICAL} horas
          </p>
        </div>

        <div className={`flex flex-wrap p-1 rounded-2xl border gap-2 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
          <div className="flex p-0.5">
            {(['day', 'week', 'month'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  period === p 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : `hover:bg-white/10 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`
                }`}
              >
                {p === 'day' ? 'Diário' : p === 'week' ? 'Semanal' : 'Mensal'}
              </button>
            ))}
          </div>
          
          <button
            onClick={generatePDF}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              isDarkMode 
                ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-600/30' 
                : 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700'
            }`}
          >
            <i className="fas fa-file-pdf"></i>
            Imprimir PDF
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-8 rounded-[2.5rem] border transition-all ${isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <i className="fas fa-exclamation-circle text-xl"></i>
             </div>
             <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Histórico</span>
                <h3 className="text-3xl font-black">{summary.total}</h3>
             </div>
          </div>
        </div>

        <div className={`p-8 rounded-[2.5rem] border transition-all ${isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                <i className="fas fa-clock text-xl"></i>
             </div>
             <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Ativos no Pátio</span>
                <h3 className="text-3xl font-black text-red-500">{summary.active}</h3>
             </div>
          </div>
        </div>

        <div className={`p-8 rounded-[2.5rem] border transition-all ${isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <i className="fas fa-check-circle text-xl"></i>
             </div>
             <div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Resolvidos/Saídas</span>
                <h3 className="text-3xl font-black text-emerald-500">{summary.resolved}</h3>
             </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className={`flex-1 p-8 rounded-[3rem] border ${isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex items-center gap-4 mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <i className="fas fa-chart-line"></i>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest">Tendência de Casos Críticos</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Volume de veículos ultrapassando o SLA ({period})</p>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={criticalCasesData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#ffffff08" : "#00000008"} />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
              />
              <Tooltip 
                cursor={{ fill: isDarkMode ? '#ffffff05' : '#f1f5f9' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className={`p-4 rounded-2xl shadow-2xl border ${isDarkMode ? 'bg-[#0f172a] border-white/10 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{payload[0].payload.fullDate}</p>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                            <i className="fas fa-exclamation-triangle text-xs"></i>
                          </div>
                          <div>
                            <span className="text-xl font-black">{payload[0].value}</span>
                            <span className="text-[10px] font-bold uppercase ml-2 text-slate-400">Casos</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="count" 
                fill="url(#barGradient)" 
                radius={[6, 6, 0, 0]} 
                barSize={period === 'day' ? 30 : 60}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Details Table */}
      <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
            <i className="fas fa-list-ul"></i>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest">Detalhamento Recente</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Últimos veículos que se tornaram críticos</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Veículo</th>
                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Consultor</th>
                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Permanência</th>
                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Pátio</th>
                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-transparent">
              {vehicles
                .map(v => {
                   const entry = new Date(v.entryTime);
                   const exit = v.exitTime ? new Date(v.exitTime) : new Date();
                   return { ...v, stayHours: differenceInHours(exit, entry) };
                })
                .filter(v => v.stayHours >= ALERT_THRESHOLDS.CRITICAL)
                .sort((a, b) => b.stayHours - a.stayHours)
                .slice(0, 10)
                .map((v) => (
                <tr key={v.id} className="group">
                  <td className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border-2 text-white flex items-center justify-center text-[10px] font-black shadow-md shrink-0" style={{ borderColor: v.prisma.color }}>
                        {v.prisma.number}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black uppercase truncate">{v.model}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{v.plate}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-xs font-bold uppercase text-slate-500">{v.consultant}</span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-sm font-black font-mono text-red-500">{v.stayHours}h</span>
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-xs font-bold uppercase text-slate-500">{v.yardId === 'yard' ? 'Sub Solo' : v.yardId.replace('yard', 'Pátio ')}</span>
                  </td>
                  <td className="py-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${v.exitTime ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500 animate-pulse'}`}>
                      {v.exitTime ? 'RESOLVIDO' : 'EM PÁTIO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CriticalCasesReport;
