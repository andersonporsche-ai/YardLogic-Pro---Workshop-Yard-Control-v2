import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Vehicle } from '../types';
import { getSlotDisplayName } from '../constants';

interface KeyBoardProps {
  vehicles: Vehicle[];
  yardOptions: { id: string; label: string; icon: string }[];
  yardLayouts: Record<string, { row: string, slots: number, label: string, isCorridor?: boolean }[]>;
  isDarkMode?: boolean;
}

const KeyBoard: React.FC<KeyBoardProps> = ({ vehicles, yardOptions, yardLayouts, isDarkMode = false }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to get row and slot info from layout
  const getSlotInfo = (yardId: string, slotIdx: number) => {
    const layout = yardLayouts[yardId];
    if (!layout) return { row: '?', pos: '?' };

    let currentIdx = 0;
    for (const sector of layout) {
      if (sector.isCorridor) continue;
      
      const sectorEnd = currentIdx + sector.slots;
      if (slotIdx >= currentIdx && slotIdx < sectorEnd) {
        return { 
          row: sector.row, 
          pos: (slotIdx - currentIdx) + 1,
          label: sector.label
        };
      }
      currentIdx = sectorEnd;
    }
    return { row: '?', pos: '?' };
  };

  // Filter only physical yard tabs (not dashboard, tasks, etc.)
  const physicalYards = yardOptions.filter(o => 
    !['overview', 'dashboard', 'tasks', 'idleHistory', 'keyBoard'].includes(o.id)
  );

  return (
    <div className={`p-6 min-h-screen ${isDarkMode ? 'bg-[#0D0F16]' : 'bg-slate-50'}`}>
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <i className="fas fa-key text-xl"></i>
              </div>
              <div>
                <h1 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Quadro de Chaves
                </h1>
                <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Controle de Localização de Veículos e Chaves
                </p>
              </div>
            </div>

            <div className="relative group w-full md:w-80">
              <i className={`fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[10px] transition-colors ${isDarkMode ? 'text-slate-600 group-focus-within:text-blue-500' : 'text-slate-400 group-focus-within:text-blue-600'}`}></i>
              <input 
                type="text" 
                placeholder="PROCURAR PLACA OU MODELO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none transition-all border ${
                  isDarkMode 
                    ? 'bg-[#12141C] border-white/5 text-white focus:border-blue-500/50 focus:bg-blue-600/5' 
                    : 'bg-white border-slate-100 text-slate-900 focus:border-blue-500/20 shadow-sm focus:shadow-blue-500/10'
                }`}
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {physicalYards.map(yard => {
            const yardVehicles = vehicles
              .filter(v => v.yardId === yard.id)
              .filter(v => 
                v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || 
                v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.prisma.number.toString().includes(searchTerm)
              )
              .sort((a, b) => a.slotIndex - b.slotIndex);

            return (
              <div 
                key={yard.id}
                className={`flex flex-col rounded-[2.5rem] border ${isDarkMode ? 'bg-[#12141C] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}
              >
                <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <i className={`fas ${yard.icon} text-[10px]`}></i>
                      </div>
                      <h2 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {yard.label}
                      </h2>
                    </div>
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isDarkMode ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                      {yardVehicles.length} VEÍCULOS
                    </span>
                  </div>
                </div>

                <div className="p-6 flex flex-col gap-3 min-h-[400px]">
                  {yardVehicles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                      <i className="fas fa-box-open text-2xl mb-2 text-slate-500"></i>
                      <p className="text-[10px] font-bold uppercase">Pátio Vazio</p>
                    </div>
                  ) : (
                    yardVehicles.map(v => (
                      <motion.div
                        key={v.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`group relative p-4 rounded-2xl border transition-all ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/5 hover:bg-blue-600/10 hover:border-blue-500/20' 
                            : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Prisma Display as a "Key Tag" */}
                          <div 
                            className="w-12 h-14 rounded-xl flex flex-col items-center justify-center text-white shadow-lg overflow-hidden shrink-0"
                            style={{ backgroundColor: v.prisma.color }}
                          >
                            <span className="text-[8px] font-bold uppercase opacity-60 leading-none mb-1">Prisma</span>
                            <span className="text-lg font-black leading-none">{v.prisma.number}</span>
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[11px] font-black uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {v.plate}
                              </span>
                              <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                {getSlotDisplayName(v.slotIndex)}
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase truncate">
                              {v.model}
                            </span>
                            <span className={`text-[8px] font-bold uppercase mt-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                              {v.consultant}
                            </span>
                          </div>

                          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="fas fa-chevron-right text-slate-500 text-[10px]"></i>
                          </div>
                        </div>

                        {/* Location Details Overlay */}
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200/50 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <i className="fas fa-map-marker-alt text-[10px] text-blue-500"></i>
                              <span className="text-[9px] font-black uppercase text-slate-500">
                                {(() => {
                                  const info = getSlotInfo(v.yardId, v.slotIndex);
                                  return `Fila ${info.row} • Posição ${info.pos}`;
                                })()}
                              </span>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${v.washStatus === 'Veículo Pronto' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`}></div>
                          </div>
                          {(() => {
                            const info = getSlotInfo(v.yardId, v.slotIndex);
                            if (info.label) {
                              return (
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-info-circle text-[8px] text-slate-400"></i>
                                  <span className="text-[8px] font-bold uppercase text-slate-400 truncate">
                                    {info.label}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KeyBoard;
