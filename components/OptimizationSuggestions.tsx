import React, { useState } from 'react';
import { generateOptimizationSuggestions } from '../services/aiService';
import { Vehicle } from '../types';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface OptimizationSuggestionsProps {
  vehicles: Vehicle[];
  isDarkMode: boolean;
}

const OptimizationSuggestions: React.FC<OptimizationSuggestionsProps> = ({ vehicles, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setIsOpen(true);
    const result = await generateOptimizationSuggestions(vehicles);
    setSuggestions(result);
    setIsLoading(false);
  };

  return (
    <>
      <button
        onClick={handleGenerate}
        className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg ${
          isDarkMode 
            ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-600/20' 
            : 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-600/20'
        }`}
      >
        <i className="fas fa-brain text-base animate-pulse"></i>
        Otimização IA
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-[3rem] border shadow-2xl flex flex-col ${
                isDarkMode ? 'bg-[#0A0B10] border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 text-xl">
                    <i className="fas fa-magic"></i>
                  </div>
                  <div>
                    <h2 className={`text-2xl font-outfit font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Sugestões de <span className="text-emerald-500">Otimização</span>
                    </h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Análise Estratégica via Gemini AI</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-white/5 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-6 py-20">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                      <i className="fas fa-brain absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl text-emerald-500 animate-pulse"></i>
                    </div>
                    <div className="text-center">
                      <h3 className={`text-lg font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Processando Dados</h3>
                      <p className="text-xs font-bold text-slate-500 mt-2">A IA está analisando o fluxo de trabalho e a ocupação dos pátios...</p>
                    </div>
                  </div>
                ) : (
                  <div className={`markdown-body ${isDarkMode ? 'prose-invert' : ''} max-w-none`}>
                    <Markdown>{suggestions || ''}</Markdown>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-white/5 bg-black/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <i className="fas fa-info-circle text-emerald-500"></i>
                  <span>Sugestões baseadas em heurísticas de logística e dados em tempo real</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OptimizationSuggestions;
