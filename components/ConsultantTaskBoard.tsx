
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle, WashStatus } from '../types';
import { CONSULTANTS } from '../constants';

interface ConsultantTaskBoardProps {
  vehicles: Vehicle[];
  onUpdateVehicle: (vehicle: Vehicle) => void;
  isDarkMode?: boolean;
}

const ConsultantTaskBoard: React.FC<ConsultantTaskBoardProps> = ({ 
  vehicles, 
  onUpdateVehicle, 
  isDarkMode = false 
}) => {
  // Group vehicles by consultant
  const groupedVehicles = useMemo(() => {
    const groups: Record<string, Vehicle[]> = {};
    CONSULTANTS.forEach(c => groups[c] = []);
    vehicles.forEach(v => {
      if (groups[v.consultant]) {
        groups[v.consultant].push(v);
      }
    });
    return groups;
  }, [vehicles]);

  const calculateProgress = (consultantVehicles: Vehicle[]) => {
    if (consultantVehicles.length === 0) return 0;
    const readyCount = consultantVehicles.filter(v => v.washStatus === 'Veículo Pronto').length;
    return Math.round((readyCount / consultantVehicles.length) * 100);
  };

  const handleToggleTask = (vehicle: Vehicle) => {
    const nextStatusMap: Record<string, WashStatus> = {
      'Não Solicitado': 'Em Fila',
      'Em Fila': 'Lavando',
      'Lavando': 'Finalizado',
      'Finalizado': 'Veículo Pronto',
      'Veículo Pronto': 'Não Solicitado'
    };

    const nextStatus = nextStatusMap[vehicle.washStatus] || 'Finalizado';
    onUpdateVehicle({
      ...vehicle,
      washStatus: nextStatus,
      statusChangedAt: new Date().toISOString()
    });
  };

  return (
    <div className={`p-6 min-h-screen flex flex-col gap-8 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter">Quadro de Tarefas por Consultor</h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Gerenciamento de Fluxo e Progressão de Entregas</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase text-slate-500">Total de Veículos</span>
            <span className="text-2xl font-black">{vehicles.length}</span>
          </div>
          <div className="w-px h-10 bg-slate-200 dark:bg-white/10"></div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase text-slate-500">Eficiência Média</span>
            <span className="text-2xl font-black text-blue-500">
              {vehicles.length > 0 ? Math.round(vehicles.filter(v => v.washStatus === 'Veículo Pronto').length / vehicles.length * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-x-auto pb-10">
        <AnimatePresence mode="popLayout">
          {CONSULTANTS.map((consultant, idx) => {
            const consultantVehicles = groupedVehicles[consultant] || [];
            const progress = calculateProgress(consultantVehicles);
            
            return (
              <motion.div
                key={consultant}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex flex-col rounded-[2.5rem] border-2 shadow-sm transition-all h-[600px] ${
                  isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100'
                }`}
              >
                <div className="p-6 border-b border-dashed border-slate-500/10">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-black text-xs uppercase">
                        {consultant.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="font-black text-sm uppercase tracking-tight">{consultant}</h3>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{consultantVehicles.length} Veículos Atribuídos</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Progresso de Entrega</span>
                      <span className="text-blue-500">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                  {consultantVehicles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 py-10">
                      <i className="fas fa-parking text-4xl mb-4"></i>
                      <p className="text-[10px] font-black uppercase tracking-widest">Sem veículos no pátio</p>
                    </div>
                  ) : (
                    consultantVehicles.map(vehicle => (
                      <div 
                        key={vehicle.id}
                        className={`p-4 rounded-3xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                          isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-xl'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Placa / ID</span>
                            <h4 className="text-sm font-black uppercase font-mono">{vehicle.plate}</h4>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className={`px-2 py-1 rounded text-[8px] font-black uppercase border ${
                              vehicle.washStatus === 'Veículo Pronto' 
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {vehicle.washStatus}
                            </div>
                            <div className={`px-2 py-1 rounded text-[8px] font-black uppercase border ${
                              vehicle.deliveryStatus === 'Entregue'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : vehicle.deliveryStatus === 'Liberado para Entrega'
                                ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                                : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                            }`}>
                              {vehicle.deliveryStatus}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">{vehicle.model}</p>
                          <p className="text-[9px] text-slate-500 mt-1 italic opacity-70 truncate max-w-[200px]">{vehicle.service}</p>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-dashed border-slate-500/10">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Fluxo de Trabalho</p>
                          <button 
                            onClick={() => handleToggleTask(vehicle)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all ${
                              vehicle.washStatus === 'Veículo Pronto'
                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'
                                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                            }`}
                          >
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              {vehicle.washStatus === 'Veículo Pronto' ? 'Concluído' : 'Próxima Etapa'}
                            </span>
                            <i className={`fas ${vehicle.washStatus === 'Veículo Pronto' ? 'fa-check-circle' : 'fa-arrow-right'} text-[10px]`}></i>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ConsultantTaskBoard;
