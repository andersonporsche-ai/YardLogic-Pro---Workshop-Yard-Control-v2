import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  isDarkMode?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "", 
  size = 40, 
  showText = true,
  isDarkMode = true 
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background Hex / Shield */}
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M50 5L90 25V75L50 95L10 75V25L50 5Z" 
            fill={isDarkMode ? "#1E293B" : "#F1F5F9"}
            stroke="#3B82F6"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          
          {/* Logical Path / Y-Shape */}
          <path 
            d="M30 30L50 50M70 30L50 50V80" 
            stroke="#3B82F6" 
            strokeWidth="8" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="animate-pulse"
          />
          
          {/* Precision Nodes */}
          <circle cx="30" cy="30" r="4" fill="#3B82F6" />
          <circle cx="70" cy="30" r="4" fill="#60A5FA" />
          <circle cx="50" cy="80" r="4" fill="#60A5FA" />
          <circle cx="50" cy="50" r="6" fill="white" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col -gap-1">
          <span className={`text-xl font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            YardLogic<span className="text-blue-500">.</span>
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-500/80 leading-none">
            Pro Control
          </span>
        </div>
      )}
    </div>
  );
};
