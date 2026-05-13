
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface KeyScannerProps {
  onScan: (keyId: string) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

const KeyScanner: React.FC<KeyScannerProps> = ({ onScan, onClose, isDarkMode = false }) => {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "key-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        if (decodedText && decodedText.trim().length > 0) {
          onScan(decodedText.trim());
          scanner.clear().catch(console.error);
        } else {
          setError("Código QR inválido ou vazio.");
        }
      },
      () => {
        // Silently handle scan errors
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
      <div className={`w-full max-w-md rounded-[2.5rem] overflow-hidden border shadow-2xl ${isDarkMode ? 'bg-[#0F1117] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div>
            <h3 className={`text-xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Vincular Chave Física</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Escaneie o QR Code da Chave</p>
          </div>
          <button 
            onClick={onClose}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8">
          <div id="key-reader" className="overflow-hidden rounded-2xl border-4 border-blue-500/20 shadow-inner"></div>
          
          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-red-500"></i>
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-tight">{error}</p>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-4">
             <div className="flex items-center gap-4 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <i className="fas fa-key text-blue-500"></i>
                </div>
                <p className={`text-[10px] font-bold leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Posicione a etiqueta da chave no centro do visor. O sistema fará a leitura automática e vinculará a chave ao veículo selecionado.
                </p>
             </div>
             
             <button 
               onClick={onClose}
               className={`w-full h-14 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all ${isDarkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
               Cancelar
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyScanner;
