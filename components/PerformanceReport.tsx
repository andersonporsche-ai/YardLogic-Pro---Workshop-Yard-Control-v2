import React, { useState, useEffect, useMemo } from 'react';
import { databaseService } from '../services/database';
import { Vehicle } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  format, 
  subDays, 
  isWithinInterval,
  startOfDay,
  endOfDay,
  differenceInHours
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PerformanceReportProps {
  isDarkMode?: boolean;
}

type ReportPeriod = '7d' | '30d' | 'all';

const PerformanceReport: React.FC<PerformanceReportProps> = ({ isDarkMode = false }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ReportPeriod>('30d');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const all = await databaseService.getAllVehicles();
        setVehicles(all);
      } catch (error) {
        console.error('Error fetching vehicles for performance report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filteredVehicles = useMemo(() => {
    const now = new Date();
    let start: Date;

    if (period === '7d') start = startOfDay(subDays(now, 6));
    else if (period === '30d') start = startOfDay(subDays(now, 29));
    else return vehicles;

    return vehicles.filter(v => {
      const date = new Date(v.entryTime);
      return isWithinInterval(date, { start, end: endOfDay(now) });
    });
  }, [vehicles, period]);

  const statsByConsultant = useMemo(() => {
    const grouped: Record<string, { totalHours: number; count: number }> = {};
    
    filteredVehicles.forEach(v => {
      const entry = new Date(v.entryTime);
      const exit = v.exitTime ? new Date(v.exitTime) : new Date();
      const stay = differenceInHours(exit, entry);
      
      if (!grouped[v.consultant]) {
        grouped[v.consultant] = { totalHours: 0, count: 0 };
      }
      grouped[v.consultant].totalHours += stay;
      grouped[v.consultant].count += 1;
    });

    return Object.entries(grouped)
      .map(([name, data]) => ({
        name,
        avg: Math.round(data.totalHours / data.count),
        count: data.count
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [filteredVehicles]);

  const statsByService = useMemo(() => {
    const grouped: Record<string, { totalHours: number; count: number }> = {};
    
    filteredVehicles.forEach(v => {
      const entry = new Date(v.entryTime);
      const exit = v.exitTime ? new Date(v.exitTime) : new Date();
      const stay = differenceInHours(exit, entry);
      const service = v.service || 'Não Informado';
      
      if (!grouped[service]) {
        grouped[service] = { totalHours: 0, count: 0 };
      }
      grouped[service].totalHours += stay;
      grouped[service].count += 1;
    });

    return Object.entries(grouped)
      .map(([name, data]) => ({
        name,
        avg: Math.round(data.totalHours / data.count),
        count: data.count
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10); // Top 10 services
  }, [filteredVehicles]);

  const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#f97316', '#a855f7', '#64748b'];

  const generatePDF = () => {
    const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
    const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR });

    // Header
    doc.setFillColor(10, 11, 16);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('YardLogic Pro', 20, 20);
    doc.setFontSize(10);
    doc.text('RELATÓRIO DE DESEMPENHO E PERMANÊNCIA', 20, 28);
    doc.text(`Gerado em: ${timestamp}`, 140, 28);

    // Consultant Table
    doc.setTextColor(10, 11, 16);
    doc.setFontSize(14);
    doc.text('Tempo Médio por Consultor', 20, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Consultor', 'Média de Permanência (h)', 'Total de Veículos']],
      body: statsByConsultant.map(s => [s.name, `${s.avg}h`, s.count]),
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Service Table
    doc.text('Tempo Médio por Tipo de Serviço (Top 10)', 20, doc.lastAutoTable.finalY + 15);
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Serviço', 'Média de Permanência (h)', 'Total de Veículos']],
      body: statsByService.map(s => [s.name, `${s.avg}h`, s.count]),
      theme: 'grid',
      headStyles: { fillColor: [10, 11, 16] }
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} - YardLogic Pro - Desempenho`, 105, 290, { align: 'center' });
    }

    doc.save(`Relatorio_Desempenho_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
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
          <h2 className="text-3xl font-black uppercase tracking-tighter">Relatório de Desempenho</h2>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
            Análise de permanência média por consultor e serviço
          </p>
        </div>

        <div className={`flex flex-wrap p-1 rounded-2xl border gap-2 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
          <div className="flex p-0.5">
            {(['7d', '30d', 'all'] as ReportPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  period === p 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : `hover:bg-white/10 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`
                }`}
              >
                {p === '7d' ? '7 Dias' : p === '30d' ? '30 Dias' : 'Tudo'}
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
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Consultant Averages */}
        <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
              <i className="fas fa-user-tie"></i>
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest">Tempo Médio por Consultor</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Permanência em horas</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsByConsultant} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? "#ffffff08" : "#00000008"} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  width={120}
                />
                <Tooltip 
                  cursor={{ fill: isDarkMode ? '#ffffff05' : '#f1f5f9' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={`p-4 rounded-2xl shadow-2xl border ${isDarkMode ? 'bg-[#0f172a] border-white/10 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{payload[0].payload.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-blue-600">{payload[0].value}h</span>
                            <span className="text-[10px] font-bold uppercase text-slate-400">em média</span>
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{payload[0].payload.count} veículos atendidos</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="avg" radius={[0, 10, 10, 0]} barSize={20}>
                  {statsByConsultant.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Service Averages */}
        <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg">
              <i className="fas fa-tools"></i>
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest">Tempo Médio por Serviço</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Top 10 serviços mais demorados (h)</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsByService} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? "#ffffff08" : "#00000008"} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  width={120}
                />
                <Tooltip 
                  cursor={{ fill: isDarkMode ? '#ffffff05' : '#f1f5f9' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={`p-4 rounded-2xl shadow-2xl border ${isDarkMode ? 'bg-[#0f172a] border-white/10 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{payload[0].payload.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-purple-600">{payload[0].value}h</span>
                            <span className="text-[10px] font-bold uppercase text-slate-400">em média</span>
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{payload[0].payload.count} serviços realizados</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="avg" radius={[0, 10, 10, 0]} barSize={20}>
                  {statsByService.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
          <h4 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Ranking de Consultores
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Consultor</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Média (h)</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Vol. Atendimentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-transparent">
                {statsByConsultant.map((s, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 font-black uppercase text-xs">{s.name}</td>
                    <td className="py-4 text-center font-mono font-black text-blue-600">{s.avg}h</td>
                    <td className="py-4 text-right font-bold text-slate-500">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`p-8 rounded-[3rem] border ${isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
          <h4 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
            Ranking de Serviços
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Serviço</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Média (h)</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Frequência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-transparent">
                {statsByService.map((s, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 font-black uppercase text-xs truncate max-w-[200px]">{s.name}</td>
                    <td className="py-4 text-center font-mono font-black text-purple-600">{s.avg}h</td>
                    <td className="py-4 text-right font-bold text-slate-500">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceReport;
