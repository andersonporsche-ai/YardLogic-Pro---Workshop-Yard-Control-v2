import React from 'react';
import { motion } from 'motion/react';

interface PorscheLogoProps {
  className?: string;
  size?: number;
}

export const PorscheLogo: React.FC<PorscheLogoProps> = ({ 
  className = "", 
  size = 40 
}) => {
  const [hasError, setHasError] = React.useState(false);

  // Link para o logotipo oficial em alta resolução
  const logoUrl = "https://www.carlogos.org/car-logos/porsche-logo.png";
  const fallbackUrl = "https://logos-world.net/wp-content/uploads/2020/04/Porsche-Logo.png";

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8, filter: 'brightness(1.5)' }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        filter: 'brightness(1)',
        y: [0, -4, 0] 
      }}
      transition={{ 
        opacity: { duration: 0.8 },
        scale: { duration: 0.8 },
        y: { 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }
      }}
      className={`relative flex items-center justify-center overflow-hidden group ${className}`} 
      style={{ width: size, minHeight: size * 0.5 }}
    >
      {/* Efeito de Brilho Metálico (Shine) */}
      <motion.div 
        animate={{ 
          x: ['-100%', '200%'],
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity, 
          repeatDelay: 5,
          ease: "easeInOut"
        }}
        className="absolute inset-0 z-10 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-[25deg] pointer-events-none"
      />

      <img 
        src={hasError ? fallbackUrl : logoUrl} 
        alt="Porsche Logo"
        referrerPolicy="no-referrer"
        className="w-full h-auto object-contain drop-shadow-2xl select-none pointer-events-none relative z-0"
        onDragStart={(e) => e.preventDefault()}
        onError={() => setHasError(true)}
      />
      
      {/* Sombra Dinâmica Sob o Logo */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-black/40 blur-md rounded-full pointer-events-none"
      />
    </motion.div>
  );
};
