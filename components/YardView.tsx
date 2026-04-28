
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Reorder, motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Vehicle, ActivityLog, ConsultantName } from '../types';
import { YARD_LAYOUT, CONSULTANTS, ALERT_THRESHOLDS, WASH_STATUS_OPTIONS } from '../constants';
import { differenceInMinutes, differenceInHours, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { getSafetyAnalysis } from '../services/geminiService';

interface YardViewProps {
  vehicles: Vehicle[];
  activityLogs: ActivityLog[];
  onSelectSlot: (index: number) => void;
  onViewHistory: (vehicleId: string) => void;
  onUpdateVehicle: (vehicle: Vehicle) => void;
  onUpdateLog: (logId: string, updates: Partial<ActivityLog>) => void;
  onRemoveVehicle: (id: string, exitTime?: string, idleReason?: string, idleActions?: string) => void;
  isDarkMode?: boolean;
  selectedSlotIndex?: number | null;
  now: Date;
  layout: typeof YARD_LAYOUT;
  layoutId: string;
  maxSlots: number;
  addToast?: (toast: { title: string; message: string; type: 'success' | 'info' | 'warning' | 'error' }) => void;
}

interface YardSector {
  row: string;
  slots: number;
  label: string;
  startIdx: number;
  yardRow?: number;
  verticalGroup?: string;
  isCorridor?: boolean;
  marginTop?: string;
  marginLeft?: string;
  orientation?: 'horizontal' | 'vertical';
  icon?: string;
}

interface SectorGroup {
  isGroup: true;
  name: string;
  sectors: YardSector[];
}

interface YardAlert {
  id: string;
  type: 'vehicle' | 'slot' | 'integrity';
  title: string;
  subtitle: string;
  details: string;
  time: string;
  severity: 'warning' | 'critical' | 'severe';
  data: Vehicle | { index: number; info: { hoursVacant: number; lastActivity: string | null } };
}

type RowItem = YardSector | SectorGroup;

const YardView: React.FC<YardViewProps> = ({ 
  vehicles, 
  activityLogs,
  onSelectSlot, 
  onViewHistory,
  onUpdateLog,
  onRemoveVehicle,
  isDarkMode = false,
  selectedSlotIndex = null,
  now,
  layout,
  layoutId,
  maxSlots,
  addToast
}) => {
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [currentLayout, setCurrentLayout] = useState(layout);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConsultant, setSelectedConsultant] = useState<ConsultantName | 'All'>('All');
  const [selectedWashStatus, setSelectedWashStatus] = useState<string | 'All'>('All');
  const [showIdleHistory, setShowIdleHistory] = useState(false);
  const [idleDurationFilter, setIdleDurationFilter] = useState<number>(12);
  const [idleReasonSearch, setIdleReasonSearch] = useState('');
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isDraggingMiniMap, setIsDraggingMiniMap] = useState(false);
  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0, width: 1, height: 1, scrollWidth: 1, scrollHeight: 1 });
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(new Set());
  const [alertQueue, setAlertQueue] = useState<YardAlert[]>([]);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [isSafetyAnalysisOpen, setIsSafetyAnalysisOpen] = useState(false);
  const [safetyInsights, setSafetyInsights] = useState<string | null>(null);
  const [riskySlots, setRiskySlots] = useState<number[]>([]);
  const [safetyScore, setSafetyScore] = useState<number | null>(null);
  const [criticalPoints, setCriticalPoints] = useState<{ area: string; risk: string; recommendation: string }[]>([]);
  const [safeRoutes, setSafeRoutes] = useState<{ from: string; to: string; route: string }[]>([]);
  const [isGeneratingSafety, setIsGeneratingSafety] = useState(false);
  const [highlightedSlot, setHighlightedSlot] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const yardContentRef = useRef<HTMLDivElement>(null);

  const goToSlot = useCallback((slotIndex: number) => {
    setHighlightedSlot(slotIndex);
    
    // Pequeno delay para garantir que o DOM está pronto se necessário
    setTimeout(() => {
      const slotElement = document.getElementById(`slot-${slotIndex}`);
      if (slotElement && scrollContainerRef.current) {
        slotElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }, 100);

    // Remove o destaque após 3 segundos
    setTimeout(() => {
      setHighlightedSlot(null);
    }, 3000);
  }, []);

  useEffect(() => {
    if (selectedSlotIndex !== null) {
      goToSlot(selectedSlotIndex);
    }
  }, [selectedSlotIndex, goToSlot]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollPos({
        left: container.scrollLeft,
        top: container.scrollTop,
        width: container.clientWidth,
        height: container.clientHeight,
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight
      });
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call
    
    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(container);
    if (yardContentRef.current) resizeObserver.observe(yardContentRef.current);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [zoomScale]);

  const handleMiniMapInteraction = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent, isDragging: boolean = false) => {
    const container = scrollContainerRef.current;
    const miniMap = document.getElementById('mini-map-container');
    if (!container || !miniMap) return;

    const rect = miniMap.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e) {
      clientX = (e as TouchEvent).changedTouches[0].clientX;
      clientY = (e as TouchEvent).changedTouches[0].clientY;
    } else {
      clientX = (e as MouseEvent | React.MouseEvent).clientX;
      clientY = (e as MouseEvent | React.MouseEvent).clientY;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    // Calculate scroll targets taking zoom into account
    const scrollLeft = x * container.scrollWidth - container.clientWidth / 2;
    const scrollTop = y * container.scrollHeight - container.clientHeight / 2;

    container.scrollTo({
      left: scrollLeft,
      top: scrollTop,
      behavior: isDragging ? 'auto' : 'smooth'
    });
  }, []);

  const handleMiniMapMouseDown = (e: React.MouseEvent) => {
    setIsDraggingMiniMap(true);
    handleMiniMapInteraction(e, true);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingMiniMap) {
        handleMiniMapInteraction(e, true);
      }
    };
    const handleGlobalMouseUp = () => {
      setIsDraggingMiniMap(false);
    };

    if (isDraggingMiniMap) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingMiniMap, handleMiniMapInteraction]);

  const isP6Layout = useMemo(() => {
    return layout.some(s => s.label === 'Pátio P6');
  }, [layout]);

  const yardName = useMemo(() => {
    const firstSector = layout.find(s => !s.isCorridor);
    return firstSector ? firstSector.label : 'Pátio Geral';
  }, [layout]);

  const getConsultantInfo = (name: ConsultantName) => {
    const index = CONSULTANTS.indexOf(name);
    return {
      number: index !== -1 ? index + 1 : '?',
      firstName: name.split(' ')[0]
    };
  };

  const getContrastColor = (hex: string) => {
    if (!hex) return 'text-white';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? 'text-slate-900' : 'text-white';
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomScale(prev => Math.min(Math.max(prev + delta, 0.4), 1.8));
    }
  };

  const handleZoom = (type: 'in' | 'out' | 'reset') => {
    if (type === 'reset') setZoomScale(1.0);
    else if (type === 'in') setZoomScale(prev => Math.min(prev + 0.1, 1.8));
    else setZoomScale(prev => Math.max(prev - 0.1, 0.4));
  };

  const handleScroll = (direction: 'left' | 'right' | 'center') => {
    const container = scrollContainerRef.current;
    const content = yardContentRef.current;
    if (!container || !content) return;

    if (direction === 'center') {
      const contentWidth = content.getBoundingClientRect().width;
      const containerWidth = container.clientWidth;
      const scrollTarget = (contentWidth / 2) - (containerWidth / 2);
      
      container.scrollTo({ 
        left: Math.max(0, scrollTarget), 
        behavior: 'smooth' 
      });
    } else {
      const scrollAmount = 400 * zoomScale;
      container.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  const hasFilterActive = useMemo(() => {
    return searchQuery !== '' || selectedConsultant !== 'All' || selectedWashStatus !== 'All';
  }, [searchQuery, selectedConsultant, selectedWashStatus]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedConsultant('All');
    setSelectedWashStatus('All');
  };

  useEffect(() => {
    const savedOrder = localStorage.getItem(`yard_layout_order_${layoutId}`);
    if (savedOrder) {
      try {
        const order = JSON.parse(savedOrder);
        const reordered = [...layout].sort((a, b) => {
          const idxA = order.indexOf(a.row);
          const idxB = order.indexOf(b.row);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        setCurrentLayout(reordered);
      } catch {
        setCurrentLayout(layout);
      }
    } else {
      setCurrentLayout(layout);
    }
  }, [layout, layoutId]);

  const handleReorder = (newOrder: typeof layout) => {
    setCurrentLayout(newOrder);
    localStorage.setItem(`yard_layout_order_${layoutId}`, JSON.stringify(newOrder.map(item => item.row)));
    
    if (addToast) {
      addToast({
        title: 'Layout Atualizado',
        message: `A nova ordem dos setores do pátio "${yardName}" foi salva com sucesso.`,
        type: 'success'
      });
    }
  };
  
  const handleGetSafetyAnalysis = async () => {
    setIsGeneratingSafety(true);
    setSafetyInsights(null);
    setRiskySlots([]);
    setSafetyScore(null);
    setCriticalPoints([]);
    setSafeRoutes([]);
    try {
      const result = await getSafetyAnalysis(vehicles, currentLayout, yardName, activityLogs);
      if (typeof result === 'object') {
        setSafetyInsights(result.insights);
        setRiskySlots(result.riskySlots || []);
        setSafetyScore(result.safetyScore);
        setCriticalPoints(result.criticalPoints || []);
        setSafeRoutes(result.safeRoutes || []);
      } else {
        setSafetyInsights(result);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingSafety(false);
    }
  };

  const resetLayout = () => {
    setCurrentLayout(layout);
    localStorage.removeItem(`yard_layout_order_${layoutId}`);
    
    if (addToast) {
      addToast({
        title: 'Layout Resetado',
        message: `A ordem padrão dos setores para o pátio "${yardName}" foi restaurada.`,
        type: 'info'
      });
    }
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesSearch = searchQuery === '' || 
        v.plate.toLowerCase().includes(searchQuery.toLowerCase()) || 
        v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesConsultant = selectedConsultant === 'All' || v.consultant === selectedConsultant;
      const matchesWashStatus = selectedWashStatus === 'All' || v.washStatus === selectedWashStatus;
      
      return matchesSearch && matchesConsultant && matchesWashStatus;
    });
  }, [vehicles, searchQuery, selectedConsultant, selectedWashStatus]);

  const yardSectors = useMemo<YardSector[]>(() => {
    let currentGlobalIdx = 0;
    return currentLayout.map(rowConfig => {
      const startIdx = currentGlobalIdx;
      const slots = rowConfig.slots || 0;
      const endIdx = startIdx + slots;
      currentGlobalIdx = endIdx;
      return { ...rowConfig, startIdx } as YardSector;
    });
  }, [currentLayout]);

  const groupedSectorsByRow = useMemo<RowItem[][]>(() => {
    const rows: RowItem[][] = [];
    yardSectors.forEach(sector => {
      const rowIdx = sector.yardRow || 0;
      if (!rows[rowIdx]) rows[rowIdx] = [];
      
      const vGroup = sector.verticalGroup;
      if (vGroup) {
        let group = rows[rowIdx].find(g => 'isGroup' in g && g.isGroup && g.name === vGroup) as SectorGroup | undefined;
        if (!group) {
          group = { isGroup: true, name: vGroup, sectors: [] };
          rows[rowIdx].push(group);
        }
        group.sectors.push(sector);
      } else {
        rows[rowIdx].push(sector);
      }
    });
    return rows.filter(r => r !== undefined);
  }, [yardSectors]);

  const getVehicleAtSlot = useCallback((index: number) => vehicles.find(v => v.slotIndex === index), [vehicles]);
  const isVehicleHighlighted = (id: string) => filteredVehicles.some(fv => fv.id === id);

  const getVacantInfo = useCallback((slotIdx: number) => {
    const searchPattern = `(Vaga ${slotIdx + 1})`;
    const lastExitLog = [...activityLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .find(l => l.action === 'exit' && l.details.includes(searchPattern));
    
    if (!lastExitLog) return { isStale: false, hoursVacant: 0, lastActivity: null };

    const exitDate = new Date(lastExitLog.timestamp);
    const hoursVacant = differenceInHours(now, exitDate);
    
    return {
      isIdle48h: hoursVacant >= 48,
      isIdle24h: hoursVacant >= 24 && hoursVacant < 48,
      isIdle12h: hoursVacant >= 12 && hoursVacant < 24,
      hoursVacant,
      lastActivity: formatDistanceToNow(exitDate, { addSuffix: true, locale: ptBR })
    };
  }, [activityLogs, now]);

  const getVacantHistory = useCallback((slotIdx: number) => {
    const searchPattern = `(Vaga ${slotIdx + 1})`;
    const logs = [...activityLogs]
      .filter(l => l.details.includes(searchPattern))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const history: { logId: string, start: string, end: string | null, hours: number, idleReason?: string }[] = [];
    
    for (let i = 0; i < logs.length; i++) {
      if (logs[i].action === 'exit') {
        const exitTime = new Date(logs[i].timestamp);
        const nextEntry = logs.slice(i + 1).find(l => l.action === 'entry');
        const endTime = nextEntry ? new Date(nextEntry.timestamp) : now;
        const hours = differenceInHours(endTime, exitTime);
        
        if (hours >= 12) {
          history.push({
            logId: logs[i].id,
            start: logs[i].timestamp,
            end: nextEntry ? nextEntry.timestamp : null,
            hours,
            idleReason: logs[i].idleReason
          });
        }
      }
    }
    return history.reverse(); // Mais recente primeiro
  }, [activityLogs, now]);

  const allIdleHistory = useMemo(() => {
    const history: { slotIdx: number, logId: string, start: string, end: string | null, hours: number, idleReason?: string }[] = [];
    for (let i = 0; i < maxSlots; i++) {
      const slotHistory = getVacantHistory(i);
      slotHistory.forEach(h => history.push({ slotIdx: i, ...h }));
    }
    return history
      .filter(h => {
        const matchesDuration = h.hours >= idleDurationFilter;
        const matchesReason = idleReasonSearch === '' || 
          (h.idleReason && h.idleReason.toLowerCase().includes(idleReasonSearch.toLowerCase()));
        return matchesDuration && matchesReason;
      })
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [getVacantHistory, maxSlots, idleDurationFilter, idleReasonSearch]);

  // Monitoramento de Alertas Críticos (SLA > {ALERT_THRESHOLDS.CRITICAL}h) e Vagas Ociosas (+24h)
  useEffect(() => {
    const criticalVehicles = vehicles.filter(v => {
      const entryDate = new Date(v.entryTime);
      const hours = differenceInHours(now, entryDate);
      return hours >= ALERT_THRESHOLDS.CRITICAL && !acknowledgedAlertIds.has(v.id);
    });

    const idleSlots = Array.from({ length: maxSlots }).map((_, i) => ({
      index: i,
      info: getVacantInfo(i)
    })).filter(item => {
      const isIdle = item.info.hoursVacant >= 24;
      const isVacant = !getVehicleAtSlot(item.index);
      const isNotAcknowledged = !acknowledgedAlertIds.has(`slot-${item.index}`);
      return isIdle && isVacant && isNotAcknowledged;
    });

    const integrityIssues = vehicles.filter(v => v.slotIndex >= maxSlots && !acknowledgedAlertIds.has(`integrity-${v.id}`));

    const newAlerts: YardAlert[] = [];

    integrityIssues.forEach(v => {
      if (!alertQueue.some(a => a.id === `integrity-${v.id}`)) {
        newAlerts.push({
          id: `integrity-${v.id}`,
          type: 'integrity',
          title: 'Erro de Integridade',
          subtitle: v.model,
          details: `Veículo registrado na vaga ${v.slotIndex + 1}, que não existe no layout atual (${maxSlots} vagas).`,
          time: 'Agora',
          severity: 'severe',
          data: v
        });
      }
    });

    criticalVehicles.forEach(v => {
      if (!alertQueue.some(a => a.id === v.id)) {
        newAlerts.push({
          id: v.id,
          type: 'vehicle',
          title: 'SLA Crítico',
          subtitle: v.model,
          details: `Veículo ultrapassou o limite de ${ALERT_THRESHOLDS.CRITICAL}h. Consultor: ${v.consultant}`,
          time: `${Math.floor(differenceInMinutes(now, new Date(v.entryTime)) / 60)}h ${differenceInMinutes(now, new Date(v.entryTime)) % 60}m`,
          severity: 'critical',
          data: v
        });
      }
    });

    idleSlots.forEach(s => {
      const id = `slot-${s.index}`;
      if (!alertQueue.some(a => a.id === id)) {
        newAlerts.push({
          id,
          type: 'slot',
          title: 'Vaga Ociosa',
          subtitle: `Vaga ${s.index + 1}`,
          details: `Vaga está vazia há mais de 24h.`,
          time: `${s.info.hoursVacant}h`,
          severity: s.info.hoursVacant >= 48 ? 'severe' : 'warning',
          data: s
        });
      }
    });

    if (newAlerts.length > 0) {
      setAlertQueue(prev => [...prev, ...newAlerts]);
    }
  }, [vehicles, activityLogs, now, acknowledgedAlertIds, alertQueue, getVacantInfo, getVehicleAtSlot, maxSlots]);

  const handleDismissAlert = (id: string) => {
    setAcknowledgedAlertIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setAlertQueue(prev => prev.filter(a => a.id !== id));
  };

  const getAlertDisplayData = (alert: YardAlert) => {
    if (alert.type === 'vehicle' || alert.type === 'integrity') {
      const v = alert.data as Vehicle;
      return {
        id: v.prisma.number,
        tag: v.plate,
        label: alert.type === 'integrity' ? 'Erro de Vaga' : 'Veículo em Atraso'
      };
    } else {
      const s = alert.data as { index: number };
      return {
        id: s.index + 1,
        tag: `Vaga ${s.index + 1}`,
        label: 'Vaga Ociosa'
      };
    }
  };

  const getStayTimeInfo = (v: Vehicle) => {
    const entryDate = new Date(v.entryTime);
    const totalMinutes = differenceInMinutes(now, entryDate);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    let colorClass = 'text-emerald-500';
    let barColor = 'bg-emerald-500';
    let statusLabel = 'EFICAZ';
    let isSevere = false;

    if (hours >= ALERT_THRESHOLDS.SEVERE) {
      colorClass = 'text-red-500';
      barColor = 'bg-red-600';
      statusLabel = 'EXCEDIDO';
      isSevere = true;
    } else if (hours >= ALERT_THRESHOLDS.CRITICAL) {
      colorClass = 'text-orange-500';
      barColor = 'bg-orange-500';
      statusLabel = 'CRÍTICO';
    } else if (hours >= ALERT_THRESHOLDS.WARNING) {
      colorClass = 'text-amber-500';
      barColor = 'bg-amber-500';
      statusLabel = 'ALERTA';
    }

    const progressPercent = Math.min((totalMinutes / (ALERT_THRESHOLDS.SEVERE * 60)) * 100, 100);

    const isAttentionRequired = hours >= ALERT_THRESHOLDS.CRITICAL;

    return { 
      formatted: `${hours}h ${minutes}m`, 
      hours,
      colorClass,
      barColor,
      statusLabel,
      isSevere,
      isAttentionRequired,
      progressPercent
    };
  };

  return (
    <div className={`flex flex-col h-full relative overflow-hidden transition-all duration-700 ${isDarkMode ? 'bg-[#07080C]' : 'bg-slate-50'}`}>
      
      {/* MINI-MAPA INTERATIVO */}
      {showMiniMap && (
        <div className="fixed bottom-8 right-8 z-[150] animate-in slide-in-from-bottom-10 duration-500">
          <div className={`p-4 rounded-[2rem] border-2 shadow-2xl backdrop-blur-xl transition-all ${isDarkMode ? 'bg-[#161922]/90 border-white/10' : 'bg-white/90 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <i className="fas fa-map text-[10px] text-blue-500"></i>
                <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Mini-Mapa</span>
              </div>
              <button onClick={() => setShowMiniMap(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>
            
            <div 
              id="mini-map-container"
              className={`relative w-48 h-32 rounded-xl overflow-hidden cursor-crosshair border transition-all ${isDraggingMiniMap ? 'ring-2 ring-blue-500/50' : ''} ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-100 border-slate-200'}`}
              onMouseDown={handleMiniMapMouseDown}
              onTouchStart={(e) => handleMiniMapInteraction(e, true)}
              onTouchMove={(e) => handleMiniMapInteraction(e, true)}
            >
              {/* Representação das Filas no Mini-Mapa */}
              <div className="absolute inset-0 p-2 flex flex-col gap-2">
                {groupedSectorsByRow.map((rowItems, rIdx) => (
                  <div key={rIdx} className="flex gap-2">
                    {rowItems.map((item, iIdx) => {
                      if ('isGroup' in item && item.isGroup) {
                        return (
                          <div key={iIdx} className="flex flex-col gap-1">
                            {item.sectors.map((s, sIdx) => (
                              <div key={sIdx} className={`w-4 h-2 rounded-sm ${isDarkMode ? 'bg-white/10' : 'bg-slate-300'}`}></div>
                            ))}
                          </div>
                        );
                      }
                      const sector = item as YardSector;
                      return (
                        <div key={iIdx} className={`w-4 h-2 rounded-sm ${sector.isCorridor ? 'opacity-20' : (isDarkMode ? 'bg-white/10' : 'bg-slate-300')}`}></div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Indicador de Viewport (Onde o usuário está olhando) */}
              <div 
                className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none transition-all duration-100"
                style={{
                  left: `${(scrollPos.left / scrollPos.scrollWidth) * 100}%`,
                  top: `${(scrollPos.top / scrollPos.scrollHeight) * 100}%`,
                  width: `${(scrollPos.width / scrollPos.scrollWidth) * 100}%`,
                  height: `${(scrollPos.height / scrollPos.scrollHeight) * 100}%`
                }}
              />
            </div>
            
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Clique para Navegar</span>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTÃO PARA REABRIR MINI-MAPA */}
      {!showMiniMap && (
        <button 
          onClick={() => setShowMiniMap(true)}
          className={`fixed bottom-8 right-8 z-[150] w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl border transition-all hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-[#161922] border-white/10 text-blue-500' : 'bg-white border-slate-200 text-blue-600'}`}
        >
          <i className="fas fa-map"></i>
        </button>
      )}

      {/* MODAL DE ALERTA CRÍTICO (SLA > {ALERT_THRESHOLDS.CRITICAL}H ou Vaga Ociosa) */}
      {alertQueue.length > 0 && !showAlertsPanel && (() => {
        const alert = alertQueue[0];
        return (
          <div className="fixed inset-0 bg-red-950/40 backdrop-blur-md flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300">
            <div className={`w-full max-w-md rounded-[2.5rem] border-2 border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-[#161922]' : 'bg-white'}`}>
              <div className={`${alert.type === 'integrity' ? 'bg-red-800' : (alert.type === 'vehicle' ? 'bg-red-600' : 'bg-amber-600')} p-8 text-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50 animate-pulse"></div>
                <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30 relative z-10">
                  <i className={`fas ${alert.type === 'integrity' ? 'fa-circle-exclamation' : (alert.type === 'vehicle' ? 'fa-triangle-exclamation' : 'fa-clock')} text-4xl text-white animate-bounce`}></i>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter relative z-10">{alert.title}</h2>
                <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em] mt-1 relative z-10">Atenção Imediata Necessária</p>
              </div>
              
              <div className="p-8">
                <div 
                  onClick={() => {
                    const slotIdx = alert.type === 'slot' ? (alert.data as { index: number }).index : (alert.data as Vehicle).slotIndex;
                    if (slotIdx !== undefined) goToSlot(slotIdx);
                  }}
                  className={`p-6 rounded-3xl border mb-6 flex items-center gap-5 cursor-pointer hover:scale-[1.02] transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div 
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg transition-transform ${alert.type === 'integrity' ? 'bg-red-900' : (alert.type === 'vehicle' ? 'bg-slate-900' : 'bg-amber-500')}`}
                    title="Vaga"
                  >
                    {getAlertDisplayData(alert).id}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {getAlertDisplayData(alert).label}
                    </span>
                    <h3 className={`text-xl font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{alert.subtitle}</h3>
                    <span className={`text-sm font-black uppercase tracking-tighter ${alert.type === 'integrity' ? 'text-red-600' : (alert.type === 'vehicle' ? 'text-red-500' : 'text-amber-500')}`}>
                      {getAlertDisplayData(alert).tag}
                    </span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border border-dashed mb-8 ${alert.type === 'integrity' ? (isDarkMode ? 'bg-red-900/20 border-red-500/40' : 'bg-red-100 border-red-300') : (alert.type === 'vehicle' ? (isDarkMode ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200') : (isDarkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'))}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${alert.type === 'integrity' ? 'text-red-600' : (alert.type === 'vehicle' ? 'text-red-500' : 'text-amber-500')}`}>
                      {alert.type === 'integrity' ? 'Inconsistência Detectada' : 'Tempo Decorrido'}
                    </span>
                    <span className={`text-lg font-black tabular-nums ${alert.type === 'integrity' ? 'text-red-700' : 'text-red-600'}`}>
                      {alert.time}
                    </span>
                  </div>
                  <p className={`text-[10px] font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {alert.details}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => handleDismissAlert(alert.id)}
                    className={`h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 ${alert.type === 'integrity' ? 'bg-red-800 hover:bg-red-700 shadow-red-900/30' : 'bg-red-600 hover:bg-red-500 shadow-red-600/30'} text-white`}
                  >
                    {alert.type === 'integrity' ? 'Ciente, Corrigir Registro' : 'Ciente, Resolver Agora'}
                  </button>
                  <button 
                    onClick={() => setShowAlertsPanel(true)}
                    className={`h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Ver todos os alertas ({alertQueue.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PAINEL LATERAL DE ALERTAS */}
      {showAlertsPanel && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md z-[400] animate-in slide-in-from-right duration-500">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setShowAlertsPanel(false)}></div>
          <div className={`h-full flex flex-col shadow-2xl ${isDarkMode ? 'bg-[#0F1117] border-l border-white/5' : 'bg-white border-l border-slate-200'}`}>
            <div className="p-8 border-b border-slate-500/10 flex items-center justify-between">
              <div className="flex flex-col">
                <h2 className={`text-2xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Central de Alertas</h2>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gerencie as notificações do pátio</span>
              </div>
              <button onClick={() => setShowAlertsPanel(false)} className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-4">
              {alertQueue.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <i className="fas fa-check-circle text-4xl text-emerald-500 opacity-20"></i>
                  </div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tudo em Ordem</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Nenhum alerta pendente no momento</p>
                </div>
              ) : (
                alertQueue.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-5 rounded-3xl border-2 transition-all hover:scale-[1.02] cursor-pointer ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-blue-500/30' : 'bg-slate-50 border-slate-100 hover:border-blue-500/30'}`}
                    onClick={() => {
                      const slotIdx = alert.type === 'slot' ? (alert.data as { index: number }).index : (alert.data as Vehicle).slotIndex;
                      if (slotIdx !== undefined) {
                        goToSlot(slotIdx);
                        setShowAlertsPanel(false);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div 
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg transition-transform ${alert.type === 'integrity' ? 'bg-red-900' : (alert.type === 'vehicle' ? 'bg-red-600' : 'bg-amber-500')}`}
                          title="Vaga"
                        >
                          {getAlertDisplayData(alert).id}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${alert.type === 'integrity' ? 'bg-red-900/20 text-red-600' : (alert.type === 'vehicle' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500')}`}>
                              {alert.type === 'integrity' ? 'Integridade' : (alert.type === 'vehicle' ? 'SLA' : 'Ociosidade')}
                            </span>
                            <span className="text-[10px] font-black text-slate-500 tabular-nums">{alert.time}</span>
                          </div>
                          <h4 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{alert.subtitle}</h4>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDismissAlert(alert.id); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all"
                        title="Descartar Alerta"
                      >
                        <i className="fas fa-check"></i>
                      </button>
                    </div>
                    <p className={`text-[10px] font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {alert.details}
                    </p>
                  </div>
                ))
              )}
            </div>

            {alertQueue.length > 0 && (
              <div className="p-8 border-t border-slate-500/10">
                <button 
                  onClick={() => {
                    alertQueue.forEach(a => handleDismissAlert(a.id));
                    setShowAlertsPanel(false);
                  }}
                  className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all active:scale-95"
                >
                  Limpar Todos os Alertas
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className={`no-print px-8 py-4 border-b transition-all flex flex-wrap items-center justify-between gap-6 shadow-xl z-20 backdrop-blur-xl ${isDarkMode ? 'bg-[#0F1117]/80 border-white/5' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex flex-col">
          <div className="flex items-center gap-4">
            <h3 className={`text-xl font-outfit font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Monitor de <span className="text-blue-500">Fluxo</span> <span className="text-slate-400 ml-2 opacity-50">| {yardName}</span>
            </h3>
            <button 
              onClick={() => setIsReorderModalOpen(true)}
              className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-400 hover:text-blue-400 hover:border-blue-400/50' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-500'}`}
              title="Personalizar Ordem dos Setores"
            >
              <i className="fas fa-grip-vertical text-[10px]"></i>
            </button>
          </div>
          <span className="text-[9px] font-space text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Gestão Tática Porsche & SLA de Pátio</span>
        </div>

        {/* Resumo de Ociosidade */}
        <div className="hidden lg:flex items-center gap-3 px-5 py-2 rounded-2xl border border-dashed border-slate-500/30 bg-slate-500/5">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest leading-none mb-1">Crítico (+48h)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-red-500">
                {Array.from({ length: maxSlots }).filter((_, i) => getVacantInfo(i).isIdle48h && !getVehicleAtSlot(i)).length}
              </span>
              <span className="text-[10px] font-bold text-red-500/60 uppercase">Unidades</span>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-500/20"></div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Ocioso (+24h)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-amber-600">
                {Array.from({ length: maxSlots }).filter((_, i) => getVacantInfo(i).isIdle24h && !getVehicleAtSlot(i)).length}
              </span>
              <span className="text-[10px] font-bold text-amber-600/60 uppercase">Unidades</span>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-500/20"></div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1">Alerta (+12h)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-orange-500">
                {Array.from({ length: maxSlots }).filter((_, i) => getVacantInfo(i).isIdle12h && !getVehicleAtSlot(i)).length}
              </span>
              <span className="text-[10px] font-bold text-orange-500/60 uppercase">Unidades</span>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-500/20"></div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Média Geral</span>
            <span className="text-xs font-black text-slate-600 uppercase">
              {(() => {
                const idleData = Array.from({ length: maxSlots }).map((_, i) => ({
                  v: getVehicleAtSlot(i),
                  info: getVacantInfo(i)
                })).filter(item => !item.v && (item.info.isIdle48h || item.info.isIdle24h || item.info.isIdle12h));

                if (idleData.length === 0) return '0h';
                const avg = idleData.reduce((acc, curr) => acc + curr.info.hoursVacant, 0) / idleData.length;
                return `${avg.toFixed(1)}h`;
              })()}
            </span>
          </div>
          <div className="w-px h-8 bg-slate-500/20"></div>
          <button 
            onClick={() => setShowIdleHistory(!showIdleHistory)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${showIdleHistory ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-slate-500/20 text-slate-500 hover:text-blue-500 hover:border-blue-500/50'}`}
          >
            <i className="fas fa-history text-[10px]"></i>
            <span className="text-[9px] font-black uppercase tracking-widest">Histórico</span>
          </button>
          <div className="w-px h-8 bg-slate-500/20"></div>
          <button 
            onClick={() => setIsReorderModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 bg-white/5 border-slate-500/20 text-slate-500 hover:text-blue-500 hover:border-blue-500/50`}
            title="Personalizar Ordem dos Setores"
          >
            <i className="fas fa-grip-vertical text-[10px]"></i>
            <span className="text-[9px] font-black uppercase tracking-widest">Layout</span>
          </button>
          <div className="w-px h-8 bg-slate-500/20"></div>
          <button 
            onClick={() => setShowAlertsPanel(!showAlertsPanel)}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${showAlertsPanel ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-white/5 border-slate-500/20 text-slate-500 hover:text-red-500 hover:border-red-500/50'}`}
            title="Central de Alertas"
          >
            <i className="fas fa-bell text-[10px]"></i>
            <span className="text-[9px] font-black uppercase tracking-widest">Alertas</span>
            {alertQueue.length > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {alertQueue.length}
              </span>
            )}
          </button>
          <div className="w-px h-8 bg-slate-500/20"></div>
          <button 
            onClick={() => {
              setIsSafetyAnalysisOpen(true);
              if (!safetyInsights && !isGeneratingSafety) {
                handleGetSafetyAnalysis();
              }
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 ${isSafetyAnalysisOpen ? 'bg-orange-600 border-orange-500 text-white shadow-lg' : 'bg-white/5 border-slate-500/20 text-slate-500 hover:text-orange-500 hover:border-orange-500/50'}`}
            title="Análise de Segurança e Colisão"
          >
            <i className={`fas ${isGeneratingSafety ? 'fa-circle-notch fa-spin' : 'fa-shield-halved'} text-[10px]`}></i>
            <span className="text-[9px] font-black uppercase tracking-widest">Segurança</span>
            {safetyScore !== null && (
              <span className="ml-1 px-1.5 py-0.5 rounded-lg bg-white/20 text-[8px] font-black">
                {safetyScore}%
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-1 max-w-5xl items-center gap-3">
          <div className={`flex items-center gap-1 border-2 rounded-xl p-1 h-12 shadow-sm ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white'}`}>
            <button onClick={() => handleScroll('left')} className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-500 hover:text-white transition-all ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} title="Scroll Esquerda"><i className="fas fa-chevron-left text-[10px]"></i></button>
            <button onClick={() => handleScroll('center')} className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-500 hover:text-white transition-all ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} title="Centralizar Visualização"><i className="fas fa-location-crosshairs text-xs"></i></button>
            <button onClick={() => handleScroll('right')} className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-500 hover:text-white transition-all ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} title="Scroll Direita"><i className="fas fa-chevron-right text-[10px]"></i></button>
          </div>

          <div className="relative group">
            <select 
              className={`h-12 px-5 pr-10 rounded-xl border-2 font-black text-[10px] uppercase outline-none min-w-[180px] appearance-none transition-all ${isDarkMode ? (selectedConsultant !== 'All' ? 'bg-[#161922] border-blue-500/50 text-white' : 'bg-[#161922] border-white/5 text-white hover:border-blue-500/50') : (selectedConsultant !== 'All' ? 'bg-white border-blue-500 text-slate-800' : 'bg-white border-slate-200 text-slate-800 hover:border-blue-500')}`}
              value={selectedConsultant}
              onChange={(e) => setSelectedConsultant(e.target.value as ConsultantName | 'All')}
            >
              <option value="All">Consultores: Todos</option>
              {CONSULTANTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <i className={`fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${selectedConsultant !== 'All' ? 'text-blue-500' : 'text-slate-500'}`}></i>
          </div>

          <div className="relative group">
            <select 
              className={`h-12 px-5 pr-10 rounded-xl border-2 font-black text-[10px] uppercase outline-none min-w-[180px] appearance-none transition-all ${isDarkMode ? (selectedWashStatus !== 'All' ? 'bg-[#161922] border-blue-500/50 text-white' : 'bg-[#161922] border-white/5 text-white hover:border-blue-500/50') : (selectedWashStatus !== 'All' ? 'bg-white border-blue-500 text-slate-800' : 'bg-white border-slate-200 text-slate-800 hover:border-blue-500')}`}
              value={selectedWashStatus}
              onChange={(e) => setSelectedWashStatus(e.target.value)}
            >
              <option value="All">Status: Todos</option>
              {WASH_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <i className={`fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${selectedWashStatus !== 'All' ? 'text-blue-500' : 'text-slate-500'}`}></i>
          </div>

          <div className="relative flex-1 flex items-center gap-3">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input 
                type="text" 
                placeholder="Buscar por ID, Cliente, Placa..." 
                className={`w-full h-12 pl-10 pr-10 border-2 rounded-xl font-bold text-sm outline-none transition-all ${isDarkMode ? (searchQuery !== '' ? 'bg-[#161922] border-blue-500/50 text-white' : 'bg-[#161922] border-white/5 text-white focus:border-blue-500/50') : (searchQuery !== '' ? 'bg-white border-blue-500 text-slate-800' : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500')}`} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
              {searchQuery !== '' && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                  title="Limpar busca"
                >
                  <i className="fas fa-times-circle text-xs"></i>
                </button>
              )}
            </div>

            {hasFilterActive && (
              <button 
                onClick={clearFilters}
                className={`h-12 px-5 rounded-xl border-2 flex items-center gap-2 font-black text-[10px] uppercase transition-all hover:scale-105 active:scale-95 shadow-lg ${isDarkMode ? 'bg-red-500 border-red-400 text-white hover:bg-red-600' : 'bg-red-600 border-red-500 text-white hover:bg-red-700'}`}
                title="Limpar todos os filtros de busca e status"
              >
                <i className="fas fa-filter-circle-xmark text-xs"></i>
                <span className="hidden md:inline">Limpar Filtros</span>
                <span className="md:hidden">Limpar</span>
              </button>
            )}

            {hasFilterActive && (
              <div className={`h-12 px-4 rounded-xl border-2 flex items-center gap-2 font-black text-[10px] uppercase ${isDarkMode ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
                <span className="tabular-nums">{filteredVehicles.length}</span>
                <span className="text-[8px] opacity-60">Encontrados</span>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-1 border-2 rounded-xl p-1 h-12 shadow-sm ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white'}`}>
            <button onClick={() => handleZoom('out')} className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-500 hover:text-white transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} title="Zoom Out (Ctrl+Wheel Down)"><i className="fas fa-minus text-[10px]"></i></button>
            <button onClick={() => handleZoom('reset')} className={`px-2 text-[9px] font-black uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} title="Resetar Zoom">{(zoomScale * 100).toFixed(0)}%</button>
            <button onClick={() => handleZoom('in')} className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-500 hover:text-white transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} title="Zoom In (Ctrl+Wheel Up)"><i className="fas fa-plus text-[10px]"></i></button>
          </div>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="flex-1 overflow-auto p-12 custom-scrollbar bg-grid-tech select-none relative"
      >
        {/* Barra de Resumo de Segurança (Floating) */}
        <AnimatePresence>
          {safetyInsights && !isSafetyAnalysisOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[50] flex items-center gap-6 px-6 py-3 rounded-2xl border-2 border-orange-500/30 bg-[#161922]/90 backdrop-blur-xl shadow-[0_20px_50px_rgba(249,115,22,0.2)] text-white"
            >
              <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white">
                  <i className="fas fa-shield-halved text-xs"></i>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-orange-500">Security Score</span>
                  <span className="text-sm font-black">{safetyScore}%</span>
                </div>
              </div>

              <div className="flex items-center gap-4 py-1">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Riscos</span>
                  <span className="text-xs font-black text-red-500">{riskySlots.length} Pontos</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Recomendações</span>
                  <span className="text-xs font-black text-blue-400">{criticalPoints.length}</span>
                </div>
              </div>

              <button 
                onClick={() => setIsSafetyAnalysisOpen(true)}
                className="ml-4 px-4 py-2 rounded-xl bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all active:scale-95"
              >
                Detalhes
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de Reordenação */}
        {isReorderModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className={`w-full max-w-md rounded-[2.5rem] border-2 shadow-2xl overflow-hidden animate-scale-in ${isDarkMode ? 'bg-[#161922] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="p-8 border-b border-slate-500/10">
                <div className="flex items-center justify-between mb-2">
                  <h2 className={`text-xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Personalizar Layout</h2>
                  <button onClick={() => setIsReorderModalOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Arraste os setores para reordenar a visualização</p>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <Reorder.Group axis="y" values={currentLayout} onReorder={handleReorder} className="flex flex-col gap-3">
                  {currentLayout.map((item) => (
                    <Reorder.Item 
                      key={item.row} 
                      value={item}
                      className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-blue-500/30' : 'bg-slate-50 border-slate-100 hover:border-blue-500/30'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                          {item.row}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-xs font-black uppercase tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {item.icon && <i className={`fas ${item.icon} text-[10px] text-blue-500/50`}></i>}
                            {item.label}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase">{item.slots} Vagas</span>
                        </div>
                      </div>
                      <i className="fas fa-grip-lines text-slate-500/40"></i>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>

              <div className="p-8 bg-slate-500/5 flex items-center justify-between">
                <button 
                  onClick={resetLayout}
                  className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors"
                >
                  Resetar Padrão
                </button>
                <button 
                  onClick={() => setIsReorderModalOpen(false)}
                  className="px-8 h-12 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        )}

        {showIdleHistory && (
          <div className={`mb-12 p-8 rounded-[2.5rem] border-2 border-dashed transition-all animate-card-fade-in ${isDarkMode ? 'bg-blue-600/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <i className="fas fa-clock-rotate-left text-xl"></i>
                </div>
                <div>
                  <h4 className={`text-2xl font-outfit font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Histórico de Ociosidade <span className="text-blue-500 text-sm ml-2">+12h</span>
                  </h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Registros de períodos em que as vagas permaneceram desocupadas</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="relative">
                  <select 
                    className={`h-10 px-4 pr-10 rounded-xl border font-black text-[10px] uppercase outline-none appearance-none transition-all ${isDarkMode ? 'bg-[#161922] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                    value={idleDurationFilter}
                    onChange={(e) => setIdleDurationFilter(Number(e.target.value))}
                  >
                    <option value={12}>Duração: &gt; 12h</option>
                    <option value={24}>Duração: &gt; 24h</option>
                    <option value={48}>Duração: &gt; 48h</option>
                    <option value={0}>Duração: Todas</option>
                  </select>
                  <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[8px] pointer-events-none"></i>
                </div>

                <div className="relative min-w-[200px]">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                  <input 
                    type="text" 
                    placeholder="Filtrar por motivo..." 
                    className={`w-full h-10 pl-9 pr-10 border rounded-xl font-bold text-[10px] outline-none transition-all ${isDarkMode ? 'bg-[#161922] border-white/10 text-white focus:border-blue-500/50' : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500'}`} 
                    value={idleReasonSearch} 
                    onChange={(e) => setIdleReasonSearch(e.target.value)} 
                  />
                  {idleReasonSearch && (
                    <button 
                      onClick={() => setIdleReasonSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <i className="fas fa-times-circle text-[10px]"></i>
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => setShowIdleHistory(false)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-white/5 text-slate-400 hover:bg-red-500 hover:text-white' : 'bg-white text-slate-400 hover:bg-red-500 hover:text-white shadow-md'}`}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
              {allIdleHistory.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-20 h-20 rounded-full bg-slate-500/5 flex items-center justify-center mb-4">
                    <i className={`fas ${idleReasonSearch ? 'fa-search-minus' : 'fa-calendar-xmark'} text-4xl opacity-20`}></i>
                  </div>
                  <span className="text-sm font-black uppercase tracking-widest opacity-40">
                    {idleReasonSearch ? `Nenhum motivo correspondente a "${idleReasonSearch}"` : 'Nenhum registro de ociosidade prolongada'}
                  </span>
                  {idleReasonSearch && (
                    <button 
                      onClick={() => setIdleReasonSearch('')}
                      className="mt-4 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              ) : (
                allIdleHistory.map((h, idx) => (
                  <div 
                    key={idx} 
                    className={`p-5 rounded-3xl border transition-all hover:scale-[1.02] cursor-pointer ${isDarkMode ? 'bg-[#161922] border-white/5 hover:border-blue-500/30 shadow-2xl' : 'bg-white border-slate-200 hover:border-blue-500/30 shadow-lg'}`}
                    onClick={() => {
                      goToSlot(h.slotIdx);
                      setShowIdleHistory(false);
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-md transition-transform"
                          title="Vaga"
                        >
                          {h.slotIdx + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Vaga {h.slotIdx + 1}</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{yardName}</span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${h.hours >= 48 ? 'bg-red-500 text-white' : h.hours >= 24 ? 'bg-amber-500 text-white' : 'bg-orange-500 text-white'}`}>
                        {h.hours}h Ociosa
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 p-3 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-2">
                          <i className="fas fa-arrow-right-from-bracket text-red-500 opacity-60"></i>
                          <span className="font-bold text-slate-500 uppercase">Saída:</span>
                        </div>
                        <span className={`font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {new Date(h.start).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="h-px w-full bg-slate-500/10"></div>
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-2">
                          <i className="fas fa-arrow-right-to-bracket text-emerald-500 opacity-60"></i>
                          <span className="font-bold text-slate-500 uppercase">Entrada:</span>
                        </div>
                        <span className={`font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {h.end ? new Date(h.end).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Atualmente Vazia'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Motivo da Ociosidade</span>
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Descreva o motivo..."
                          className={`w-full h-10 px-4 rounded-xl border text-[10px] font-bold outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'}`}
                          defaultValue={h.idleReason || ''}
                          onBlur={(e) => onUpdateLog(h.logId, { idleReason: e.target.value })}
                        />
                        <i className="fas fa-pen absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 pointer-events-none"></i>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Sidebar de Análise de Segurança */}
        <AnimatePresence>
          {isSafetyAnalysisOpen && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className={`fixed right-0 top-0 bottom-0 w-full sm:w-[450px] z-[250] shadow-[-20px_0_80px_rgba(0,0,0,0.4)] flex flex-col border-l backdrop-blur-md ${isDarkMode ? 'bg-[#0A0B10]/95 border-white/10' : 'bg-white/95 border-slate-200'}`}
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-3xl bg-orange-600 flex items-center justify-center text-white shadow-2xl shadow-orange-500/40 relative overflow-hidden`}>
                    {isGeneratingSafety && (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-4 border-white/20 border-t-white rounded-full scale-150"
                      />
                    )}
                    <i className={`fas ${isGeneratingSafety ? 'fa-compass-drafting' : 'fa-shield-halved'} text-2xl relative z-10`}></i>
                  </div>
                  <div>
                    <h4 className={`text-2xl font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Safety Insight <span className="text-orange-500 ml-1">AI</span>
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Análise de Risco em Tempo Real</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleGetSafetyAnalysis}
                    disabled={isGeneratingSafety}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-orange-500 hover:bg-orange-500/10 transition-colors"
                    title="Recalcular Análise"
                  >
                    <i className={`fas fa-sync ${isGeneratingSafety ? 'fa-spin' : ''}`}></i>
                  </button>
                  <button 
                    onClick={() => setIsSafetyAnalysisOpen(false)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {!safetyInsights && !isGeneratingSafety ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <i className="fas fa-microchip text-5xl mb-6 text-orange-500"></i>
                  <h5 className="text-sm font-black uppercase tracking-widest mb-2">Análise Não Iniciada</h5>
                  <p className="text-[10px] font-bold uppercase tracking-tight max-w-[200px]">Execute a análise para identificar riscos e otimizar fluxos</p>
                </div>
              ) : isGeneratingSafety ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <i className="fas fa-radar text-3xl text-orange-500 animate-pulse"></i>
                    </div>
                  </div>
                  <h5 className="text-sm font-black uppercase tracking-widest mb-2">Processando Layout...</h5>
                  <p className="text-[10px] font-bold uppercase tracking-tight text-slate-500">A IA está calculando vetores de risco e densidade</p>
                </div>
              ) : (
                <div className="space-y-8 animate-card-fade-in">
                  {/* Score de Segurança */}
                  <div className={`p-6 rounded-3xl border-2 border-dashed ${isDarkMode ? 'bg-orange-500/5 border-orange-500/20' : 'bg-orange-50 border-orange-200'}`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className={isDarkMode ? "text-white/5" : "text-slate-200"} />
                            <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="6" className="text-orange-500" strokeDasharray={`${(safetyScore || 0) * 1.76}, 200`} strokeLinecap="round" />
                          </svg>
                          <span className="text-xl font-black text-orange-500">{safetyScore}%</span>
                        </div>
                        <div>
                          <h6 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Safety Score</h6>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Nível de Integridade Operacional</p>
                        </div>
                      </div>
                    </div>
                    {riskySlots.length > 0 && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
                        <i className="fas fa-triangle-exclamation animate-pulse"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">{riskySlots.length} Vagas Críticas Detectadas</span>
                      </div>
                    )}
                  </div>

                  {/* Pontos Críticos */}
                  {criticalPoints.length > 0 && (
                    <div className="space-y-4">
                      <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <i className="fas fa-map-pin text-red-500"></i> Pontos Críticos
                      </h5>
                      <div className="space-y-3">
                        {criticalPoints.map((point, idx) => (
                          <div key={idx} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{point.area}</span>
                              <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-500 border border-red-500/20">Risco Alto</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-3">{point.risk}</p>
                            <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/10">
                              <i className="fas fa-lightbulb text-[9px] text-orange-500 mt-0.5"></i>
                              <p className="text-[9px] font-bold text-orange-500 uppercase leading-tight">{point.recommendation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rotas Seguras */}
                  {safeRoutes.length > 0 && (
                    <div className="space-y-4">
                      <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <i className="fas fa-route text-blue-500"></i> Rotas Sugeridas
                      </h5>
                      <div className="space-y-3">
                        {safeRoutes.map((route, idx) => (
                          <div key={idx} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase">{route.from}</span>
                              <i className="fas fa-long-arrow-right text-[8px] text-slate-300"></i>
                              <span className="text-[9px] font-black text-blue-500 uppercase">{route.to}</span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">{route.route}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Insights Detalhados */}
                  <div className="space-y-4">
                    <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <i className="fas fa-brain text-purple-500"></i> Análise Cognitiva
                    </h5>
                    <div className={`p-6 rounded-2xl border leading-relaxed text-[11px] font-medium markdown-body ${isDarkMode ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                      <Markdown>{safetyInsights}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-white/5">
              <button 
                onClick={handleGetSafetyAnalysis}
                disabled={isGeneratingSafety}
                className={`w-full h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                  isGeneratingSafety 
                    ? 'bg-slate-500/20 text-slate-500 cursor-not-allowed' 
                    : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/20 active:scale-95'
                }`}
              >
                {isGeneratingSafety ? (
                  <><i className="fas fa-circle-notch fa-spin"></i> Processando...</>
                ) : (
                  <><i className="fas fa-bolt"></i> Atualizar Análise</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        <div 
          ref={yardContentRef}
          className={`flex flex-col min-w-max transition-transform duration-500 ease-out ${isP6Layout ? 'gap-10' : 'gap-20'}`}
          style={{ 
            transform: `scale(${zoomScale})`, 
            transformOrigin: 'top left',
            paddingBottom: '200px',
            paddingRight: '200px'
          }}
        >
          {groupedSectorsByRow.map((rowItems, rowIndex) => (
            <div key={rowIndex} className={`flex ${isP6Layout ? 'gap-6' : 'gap-12'}`}>
              {rowItems.map((item) => {
                const renderSector = (sector: YardSector) => {
                  if (sector.isCorridor) {
                    return (
                      <div key={`corridor-${sector.row || Math.random()}`} className={`${isP6Layout ? 'h-28 my-3' : 'h-40 my-6'} flex flex-col items-center justify-center relative w-[320px] group/corridor`} style={{ ...(sector.marginTop ? { marginTop: sector.marginTop } : {}), ...(sector.marginLeft ? { marginLeft: sector.marginLeft } : {}) }}>
                        {/* Linhas de borda do corredor */}
                        <div className={`absolute inset-x-0 top-0 h-1 border-t-2 border-dashed ${isDarkMode ? 'border-white/10' : 'border-slate-300'}`}></div>
                        <div className={`absolute inset-x-0 bottom-0 h-1 border-t-2 border-dashed ${isDarkMode ? 'border-white/10' : 'border-slate-300'}`}></div>
                        
                        {/* Textura de asfalto/piso */}
                        <div className={`w-full h-full opacity-[0.05] ${isDarkMode ? 'bg-white' : 'bg-slate-900'} transition-opacity group-hover/corridor:opacity-[0.08]`} 
                             style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 15px, currentColor 15px, currentColor 30px)' }}>
                        </div>
                        
                        {/* Linha central do corredor (estilo estrada) */}
                        <div className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 border-t border-dashed opacity-20 ${isDarkMode ? 'border-white' : 'border-slate-900'}`}></div>

                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border-2 text-[9px] font-black uppercase tracking-[0.25em] transition-all group-hover/corridor:scale-110 ${isDarkMode ? 'bg-[#161922]/80 border-white/10 text-slate-400 shadow-[0_0_20px_rgba(255,255,255,0.05)]' : 'bg-white/80 border-slate-200 text-slate-500 shadow-lg'}`}>
                            <i className="fas fa-arrows-left-right text-[8px] text-blue-500"></i>
                            Corredor
                            <i className="fas fa-arrows-left-right text-[8px] text-blue-500"></i>
                          </div>
                          <div className="flex gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDarkMode ? 'bg-white/20' : 'bg-slate-300'}`}></div>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse delay-75 ${isDarkMode ? 'bg-white/20' : 'bg-slate-300'}`}></div>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse delay-150 ${isDarkMode ? 'bg-white/20' : 'bg-slate-300'}`}></div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const isZeroSector = sector.row === 'A' || sector.row === 'B' || sector.row.includes('Fila');
                  const isHorizontal = sector.orientation === 'horizontal';
                  
                  return (
                    <div key={sector.row} className={`flex ${isHorizontal ? 'flex-row items-center gap-8' : 'flex-col gap-6'} ${isP6Layout ? (isHorizontal ? 'w-auto' : 'w-[320px]') : 'w-[320px]'}`} style={{ ...(sector.marginTop ? { marginTop: sector.marginTop } : {}), ...(sector.marginLeft ? { marginLeft: sector.marginLeft } : {}) }}>
                <div className={`flex items-center gap-3 ${isHorizontal ? 'min-w-[140px]' : ''}`}>
                  <div className="relative">
                    <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ${isDarkMode ? 'bg-white/5 text-white border border-white/10' : 'bg-slate-900 text-white'}`}>
                      {sector.row.length > 2 ? sector.row.split(' ')[1] : sector.row}
                    </span>
                    {isZeroSector && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white shadow-lg border-2 border-white">
                        <i className="fas fa-star text-[7px]"></i>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isZeroSector ? 'text-emerald-500' : (isDarkMode ? 'text-white' : 'text-slate-800')}`}>
                      {sector.icon && <i className={`fas ${sector.icon} text-[10px] opacity-70`}></i>}
                      {sector.label}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{sector.slots} Vagas</p>
                  </div>
                </div>

                <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} gap-5`}>
                  {Array.from({ length: sector.slots }).map((_, i) => {
                    const idx = sector.startIdx + i;
                    const v = getVehicleAtSlot(idx);
                    const isSelected = selectedSlotIndex === idx;
                    const info = v ? getStayTimeInfo(v) : null;
                    const vacantInfo = !v ? getVacantInfo(idx) : null;
                    const isHighlighted = v ? isVehicleHighlighted(v.id) : false;
                    
                    const pulseHighlight = v && hasFilterActive && isHighlighted ? 'animate-pulse-subtle shadow-blue-500/20 z-10' : '';
                    const emptyAnim = !v && !hasFilterActive ? 'animate-soft-float' : '';
                    
                    let opacityClass = 'opacity-100 scale-100';
                    if (hasFilterActive) {
                      if (v) {
                        const isAttention = info?.isAttentionRequired;
                        opacityClass = (isHighlighted || isAttention) 
                          ? 'opacity-100 scale-[1.02] z-10' 
                          : 'opacity-20 grayscale scale-[0.97] blur-[0.5px]';
                      } else {
                        opacityClass = 'opacity-20 grayscale scale-[0.97]';
                      }
                    }

                    const staleVacantClass = vacantInfo?.isStale 
                      ? (isDarkMode 
                          ? 'bg-amber-500/[0.08] border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.15)] ring-2 ring-amber-500/40 animate-stale-pulse' 
                          : 'bg-amber-50 border-amber-300 shadow-xl animate-stale-pulse ring-2 ring-amber-500/30') 
                      : (isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200');

                    return (
                      <React.Fragment key={idx}>
                        {sector.label === 'Pátio P2' && sector.row !== 'A' && i === 2 && (
                          <div className="h-28 flex flex-col items-center justify-center relative my-2">
                            {/* Linhas de Limite Técnicas */}
                            <div className={`absolute inset-x-0 top-0 h-px border-t border-dashed ${isDarkMode ? 'border-white/10' : 'border-slate-300'}`}></div>
                            <div className={`absolute inset-x-0 bottom-0 h-px border-t border-dashed ${isDarkMode ? 'border-white/10' : 'border-slate-300'}`}></div>
                            
                            {/* Fundo com Listras de Segurança (Hazard Stripes) */}
                            <div className={`w-full h-full opacity-[0.03] ${isDarkMode ? 'bg-white' : 'bg-slate-900'}`} 
                                 style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px)' }}>
                            </div>

                            {/* Label Centralizado */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                              <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                <i className="fas fa-arrows-left-right text-[7px]"></i>
                                Corredor de Manobra
                              </div>
                              <div className={`w-1 h-1 rounded-full ${isDarkMode ? 'bg-white/20' : 'bg-slate-300'}`}></div>
                            </div>
                          </div>
                        )}
                        <motion.div 
                          key={`${idx}-${v ? v.id : 'empty'}`}
                          id={`slot-${idx}`}
                          onClick={() => onSelectSlot(idx)}
                          initial={v ? { scale: 0.9, opacity: 0 } : { opacity: 0, y: 10 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 400, 
                            damping: 30,
                            opacity: { duration: 0.3 }
                          }}
                          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-5 pl-10 rounded-[2.8rem] border-2 transition-all duration-500 ease-in-out cursor-pointer group flex flex-col gap-3 overflow-hidden ${
                            v 
                              ? `${isDarkMode ? 'bg-[#161922] border-white/5 shadow-2xl' : 'bg-white border-slate-100 shadow-xl hover:shadow-2xl'}`
                              : `${staleVacantClass} border-dashed hover:bg-blue-500/5 ${emptyAnim}`
                          } ${isSelected ? 'animate-selected-fluid' : ''} ${info?.isAttentionRequired ? 'animate-critical-pulse ring-2 ring-red-500/30' : ''} ${info?.hours && info.hours >= 8 ? 'ring-4 ring-red-500 ring-offset-4 z-50 animate-critical-pulse' : ''} ${v?.washStatus === 'Veículo Pronto' ? 'animate-ready-pulse' : ''} ${opacityClass} ${pulseHighlight} ${highlightedSlot === idx ? 'animate-selection-highlight' : ''} ${riskySlots.includes(idx) ? 'ring-4 ring-orange-500 ring-offset-4 z-50 animate-pulse' : ''}`}
                        >
                          {(info?.isAttentionRequired || riskySlots.includes(idx)) && (
                            <div className={`absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce ${info?.hours && info.hours >= 8 ? 'bg-red-600 scale-110 shadow-red-500/50' : 'bg-orange-500'}`}>
                              <i className={`fas ${info?.hours && info.hours >= 8 ? 'fa-skull-crossbones' : 'fa-triangle-exclamation'} text-xs`}></i>
                            </div>
                          )}
                          {info?.hours && info.hours >= 8 && (
                            <div className="absolute inset-0 bg-red-500/[0.03] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(239,68,68,0.05) 20px, rgba(239,68,68,0.05) 40px)' }}></div>
                          )}
                          {/* Marcações de Chão para Vagas */}
                          {!v && (
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(90deg, currentColor 1px, transparent 1px), linear-gradient(0deg, currentColor 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                          )}
                        {/* TAG LATERAL DE CONSULTOR OU ALERTA OCIOSO */}
                        <div 
                          className={`absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center justify-center transition-colors shadow-inner ${
                          v 
                            ? '' // Estilizado abaixo via style para usar cor do prisma
                            : (vacantInfo?.isStale ? 'bg-amber-500 text-white shadow-lg' : 'opacity-0 group-hover:opacity-10 bg-slate-200')
                        }`}
                        style={v ? { 
                          backgroundColor: v.prisma.color, 
                          color: getContrastColor(v.prisma.color).includes('slate-900') ? '#0f172a' : '#ffffff'
                        } : {}}
                        >
                          {v ? (
                            <>
                              <span className={`text-[10px] font-black tracking-widest mb-2 drop-shadow-sm`}>C#{getConsultantInfo(v.consultant).number}</span>
                              <div className={`h-px w-4 mb-2 opacity-30 ${getContrastColor(v.prisma.color).includes('slate-900') ? 'bg-black' : 'bg-white'}`}></div>
                              <span className={`text-[8px] font-black uppercase rotate-90 origin-center whitespace-nowrap opacity-70 drop-shadow-sm`}>
                                {getConsultantInfo(v.consultant).firstName}
                              </span>
                            </>
                          ) : (
                            <i className={`fas ${vacantInfo?.isStale ? 'fa-hourglass-end' : 'fa-plus'} text-[10px] ${vacantInfo?.isStale ? 'animate-pulse' : ''}`}></i>
                          )}
                        </div>

                        {v ? (
                          <>
                            {/* CABEÇALHO DO CARD - ID E PRISMA INTEGRADOS */}
                            <div className="flex justify-between items-start">
                              <div className="flex gap-1.5 items-center flex-wrap max-w-[75%]">
                                <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-md shrink-0 ${isDarkMode ? 'bg-blue-600 text-white border border-blue-500/30' : 'bg-slate-900 text-white'}`}>
                                  ID-{v.id.slice(0, 6)}
                                </div>
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md border shrink-0 transition-transform hover:scale-110 ${isDarkMode ? 'bg-[#1e2330] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`}>
                                   <div className="w-3 h-3 rounded-full border-2 border-white/30 shadow-sm" style={{ backgroundColor: v.prisma.color }} />
                                   <span className="tabular-nums">#{v.prisma.number}</span>
                                </div>
                              </div>
                              <div className={`flex items-center gap-1.5 font-black uppercase tracking-tighter shrink-0 ${info?.colorClass}`}>
                                {info?.isAttentionRequired && (
                                  <i className="fas fa-triangle-exclamation text-red-500 animate-pulse mr-1"></i>
                                )}
                                <i className={`fas fa-clock text-[10px] ${info?.isAttentionRequired ? 'animate-pulse' : ''}`}></i>
                                <span className="text-[12px]">{info?.formatted}</span>
                              </div>
                            </div>
                            
                            {/* NOME DO CLIENTE E STATUS DE ENTREGA */}
                            <div className="flex flex-col gap-2">
                              <div className={`px-3 py-1.5 rounded-xl border flex items-center justify-between shadow-sm transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-user-tag text-[9px]"></i>
                                  <span className="text-[10px] font-black uppercase tracking-tighter truncate max-w-[120px]">
                                    {v.customer || 'Cliente não informado'}
                                  </span>
                                </div>
                                
                                {/* Delivery Status Badge */}
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase tracking-widest ${
                                  v.deliveryStatus === 'Entregue' 
                                    ? (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600')
                                    : v.deliveryStatus === 'Liberado para Entrega'
                                    ? (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600')
                                    : v.deliveryStatus === 'Cancelado'
                                    ? (isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600')
                                    : (isDarkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-600')
                                }`}>
                                  <i className={`fas ${
                                    v.deliveryStatus === 'Entregue' ? 'fa-check' :
                                    v.deliveryStatus === 'Liberado para Entrega' ? 'fa-truck-fast' :
                                    v.deliveryStatus === 'Cancelado' ? 'fa-ban' : 'fa-hourglass'
                                  } text-[7px]`}></i>
                                  {v.deliveryStatus}
                                </div>
                              </div>
                            </div>

                            {/* INFORMAÇÕES DO VEÍCULO */}
                            <div className="flex flex-col mt-1">
                              <span className={`text-[9px] font-black uppercase tracking-tighter mb-0.5 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                                {sector.row}{i + 1} • {sector.label}
                              </span>
                              <div className="flex flex-col">
                                <h5 className={`text-xl font-black uppercase tracking-tighter leading-none mb-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                  {v.plate}
                                </h5>
                                <span className={`text-[11px] font-black uppercase truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {v.model.replace('Porsche ', '')}
                                </span>
                              </div>
                            </div>

                            {/* SERVIÇO EM EXECUÇÃO */}
                            <div className={`flex items-center gap-3 p-3 rounded-2xl border border-dashed transition-all ${isDarkMode ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                              <div className={`w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500`}>
                                <i className="fas fa-gear animate-spin-slow text-[11px]"></i>
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Operação Oficina</span>
                                <span className={`text-[10px] font-bold uppercase truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                  {v.service}
                                </span>
                              </div>
                            </div>

                            {/* RODAPÉ DO CARD */}
                            <div className={`pt-3 border-t border-dashed mt-1 flex items-center justify-between ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                               <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${isDarkMode ? 'bg-white/5 border border-white/5' : 'bg-slate-100 border border-slate-200/50'}`}>
                                 <i className="fas fa-user-tie text-[8px] text-slate-400"></i>
                                 <span className={`text-[9px] font-black uppercase tracking-tight truncate max-w-[100px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                   {v.consultant}
                                 </span>
                               </div>
                               <button 
                                  onClick={(e) => { e.stopPropagation(); onViewHistory(v.id); }}
                                  className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 transition-colors"
                               >
                                 Timeline <i className="fas fa-chevron-right ml-1 text-[7px]"></i>
                               </button>
                               <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (window.confirm(`Confirmar saída do veículo ${v.plate}?`)) {
                                      onRemoveVehicle(v.id); 
                                    }
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                               >
                                 <i className="fas fa-sign-out-alt text-[8px]"></i>
                                 <span className="text-[9px] font-black uppercase tracking-tight">Saída</span>
                               </button>
                            </div>

                            {/* BARRA DE SLA */}
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/5 overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${info?.barColor} opacity-70 shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                                style={{ width: `${info?.progressPercent}%` }}
                              />
                            </div>
                          </>
                         ) : (
                          /* VAGA VAZIA */
                          <div className="flex-1 flex flex-col items-center justify-center py-12 transition-all duration-500 group-hover:opacity-100">
                             {vacantInfo?.isIdle48h && (
                               <>
                                 <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                                   <div className="absolute top-0 left-0 right-0 h-1 bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-scanner-line"></div>
                                 </div>
                                 <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-600 text-white shadow-lg z-20 animate-critical-pulse">
                                   <i className="fas fa-skull-crossbones text-[10px]"></i>
                                   <span className="text-[8px] font-black uppercase tracking-tighter">Crítico +48h</span>
                                 </div>
                               </>
                             )}
                             {!vacantInfo?.isIdle48h && vacantInfo?.isIdle24h && (
                               <>
                                 <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                                   <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-scanner-line"></div>
                                 </div>
                                 <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500 text-white shadow-lg z-20 animate-soft-float">
                                   <i className="fas fa-triangle-exclamation text-[10px]"></i>
                                   <span className="text-[8px] font-black uppercase tracking-tighter">Ociosa +24h</span>
                                 </div>
                               </>
                             )}
                             {!vacantInfo?.isIdle48h && !vacantInfo?.isIdle24h && vacantInfo?.isIdle12h && (
                               <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-sm z-20">
                                 <i className="fas fa-clock text-[10px]"></i>
                                 <span className="text-[8px] font-black uppercase tracking-tighter">Livre +12h</span>
                               </div>
                             )}

                             <div className={`w-14 h-14 rounded-full border-4 border-dashed flex items-center justify-center mb-3 transition-all duration-700 ${vacantInfo?.isIdle48h ? 'border-red-600 text-red-600 scale-110 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : vacantInfo?.isIdle24h ? 'border-amber-500 text-amber-500 scale-110 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : vacantInfo?.isIdle12h ? 'border-orange-500 text-orange-500 opacity-50 group-hover:opacity-100' : 'border-blue-500 text-blue-500 opacity-10 group-hover:opacity-100'}`}>
                               <i className={`fas ${vacantInfo?.isIdle48h ? 'fa-triangle-exclamation' : vacantInfo?.isIdle24h ? 'fa-clock-rotate-left' : vacantInfo?.isIdle12h ? 'fa-clock' : 'fa-plus'} text-lg`}></i>
                             </div>
                             
                             <div className="flex flex-col items-center text-center px-4">
                               <span className={`text-[11px] font-black uppercase tracking-widest ${vacantInfo?.isIdle48h ? 'text-red-600' : vacantInfo?.isIdle24h ? 'text-amber-600' : vacantInfo?.isIdle12h ? 'text-orange-500 opacity-80 group-hover:opacity-100' : 'text-blue-500 opacity-20 group-hover:opacity-100'}`}>
                                 {vacantInfo?.isIdle48h ? 'Bloqueio Crítico' : vacantInfo?.isIdle24h ? 'Vaga Inativa' : 'Vaga Livre'}
                               </span>
                               {(vacantInfo?.isIdle48h || vacantInfo?.isIdle24h || vacantInfo?.isIdle12h) && (
                                 <div className="flex flex-col items-center mt-2">
                                    <span className={`text-[9px] font-bold uppercase ${vacantInfo?.isIdle48h ? 'text-red-500' : vacantInfo?.isIdle24h ? 'text-amber-500/80' : 'text-orange-500/80'}`}>Vazia há {vacantInfo.hoursVacant}h</span>
                                    {vacantInfo.lastActivity && (
                                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter opacity-50 mt-1 italic">
                                        Check-out: {vacantInfo.lastActivity}
                                      </span>
                                    )}
                                 </div>
                               )}
                             </div>
                           </div>
                        )}
                      </motion.div>
                    </React.Fragment>
                  );
                })}
                </div>
              </div>
            );
          };

            if ('isGroup' in item && item.isGroup) {
              return (
                <div key={item.name} className="flex flex-col gap-12">
                  {item.sectors.map((sector) => renderSector(sector))}
                </div>
              );
            }
            return renderSector(item);
          })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default YardView;
