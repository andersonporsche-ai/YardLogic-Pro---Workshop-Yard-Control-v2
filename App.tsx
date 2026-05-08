
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, Reorder, AnimatePresence, useDragControls } from 'motion/react';
import YardView from './components/YardView';
import VehicleForm from './components/VehicleForm';
import Dashboard from './components/Dashboard';
import VehicleHistory from './components/VehicleHistory';
import OperationsOverview from './components/OperationsOverview';
import PrismaScanner from './components/PrismaScanner';
import OptimizationSuggestions from './components/OptimizationSuggestions';
import Auth from './components/Auth';
import ConsultantTaskBoard from './components/ConsultantTaskBoard';
import IdleHistory from './components/IdleHistory';
import CriticalCasesReport from './components/CriticalCasesReport';
import KeyBoard from './components/KeyBoard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Vehicle, ActivityLog, User } from './types';
// Removed parseISO as it was causing an export error
import { differenceInHours } from 'date-fns';
import { MAX_SLOTS, MAX_SLOTS_FACTORY, MAX_SLOTS_1ST_FLOOR, MAX_SLOTS_1ST_FACTORY, MAX_SLOTS_P1, MAX_SLOTS_P2, MAX_SLOTS_P6, MAX_SLOTS_COBERTURA, YARD_LAYOUT, YARD_LAYOUT_FACTORY, YARD_LAYOUT_1ST_FLOOR, YARD_LAYOUT_1ST_FACTORY, YARD_LAYOUT_P1, YARD_LAYOUT_P2, YARD_LAYOUT_P6, YARD_LAYOUT_COBERTURA, ALERT_THRESHOLDS, CONSULTANTS, DEFAULT_YARD_OPTIONS } from './constants';
import { supabase } from './services/supabase';
import { databaseService } from './services/database';

type ThemeMode = 'auto' | 'light' | 'dark';
type YardTab = 'yard' | 'yard2' | 'yard3' | 'yard4' | 'yardP1' | 'yardP2' | 'yardP6' | 'yardCob' | 'dashboard' | 'tasks' | 'idleHistory' | 'overview' | 'keyBoard' | 'criticalReport';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface DraggableYardItemProps {
  option: { id: string; label: string; icon: string };
  activeTab: YardTab;
  setActiveTab: (tab: YardTab) => void;
}

const DraggableYardItem: React.FC<DraggableYardItemProps> = ({ option, activeTab, setActiveTab }) => {
  const controls = useDragControls();

  return (
    <Reorder.Item 
      value={option}
      id={option.id}
      dragListener={false}
      dragControls={controls}
      className="relative list-none"
    >
      <button 
        id={`tab-${option.id}`}
        onClick={() => setActiveTab(option.id as YardTab)}
        className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all relative group shadow-sm ${
          activeTab === option.id 
            ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-900/40 z-10' 
            : 'bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 font-bold hover:text-white'
        }`}
      >
        <i className={`fas ${option.icon} text-lg w-6 shrink-0 ${activeTab === option.id ? 'text-white' : 'text-slate-500'}`}></i> 
        <span className="truncate text-xs font-black uppercase tracking-widest">{option.label}</span>
        
        <div 
          onPointerDown={(e) => controls.start(e)}
          className={`ml-auto cursor-grab active:cursor-grabbing p-1.5 rounded-lg transition-all ${
            activeTab === option.id 
              ? 'text-white/40 hover:text-white hover:bg-white/10' 
              : 'text-slate-600 hover:text-slate-400 hover:bg-white/5 opacity-0 group-hover:opacity-100'
          }`}
        >
          <i className="fas fa-grip-vertical text-xs"></i>
        </div>
      </button>
    </Reorder.Item>
  );
};

const App: React.FC = () => {
  const parseVehicles = (saved: string | null): Vehicle[] => {
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((v: Record<string, unknown>) => ({
        ...v,
        deliveryStatus: (v.deliveryStatus as string) || 'Aguardando Liberação',
        statusChangedAt: (v.statusChangedAt as string) || (v.entryTime as string) || new Date().toISOString()
      }));
    } catch {
      return [];
    }
  };

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    return parseVehicles(localStorage.getItem('yard_vehicles'));
  });

  const [vehicles2, setVehicles2] = useState<Vehicle[]>(() => {
    return parseVehicles(localStorage.getItem('yard_vehicles_2'));
  });

  const [vehicles3, setVehicles3] = useState<Vehicle[]>(() => {
    return parseVehicles(localStorage.getItem('yard_vehicles_3'));
  });

  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('yard_activity_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [logs2, setLogs2] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('yard_activity_logs_2');
    return saved ? JSON.parse(saved) : [];
  });

  const [logs3, setLogs3] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('yard_activity_logs_3');
    return saved ? JSON.parse(saved) : [];
  });

  const [vehicles4, setVehicles4] = useState<Vehicle[]>(() => {
    return parseVehicles(localStorage.getItem('yard_vehicles_4'));
  });

  const [logs4, setLogs4] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('yard_activity_logs_4');
    return saved ? JSON.parse(saved) : [];
  });

  const [vehiclesP1, setVehiclesP1] = useState<Vehicle[]>(() => {
    return parseVehicles(localStorage.getItem('yard_vehicles_p1'));
  });

  const [logsP1, setLogsP1] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('yard_activity_logs_p1');
    return saved ? JSON.parse(saved) : [];
  });

  const [vehiclesP2, setVehiclesP2] = useState<Vehicle[]>(() => {
    return parseVehicles(localStorage.getItem('yard_vehicles_p2'));
  });

  const [logsP2, setLogsP2] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('yard_activity_logs_p2');
    return saved ? JSON.parse(saved) : [];
  });

  const [vehiclesP6, setVehiclesP6] = useState<Vehicle[]>(() => {
    return parseVehicles(localStorage.getItem('yard_vehicles_p6'));
  });

  const [logsP6, setLogsP6] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('yard_activity_logs_p6');
    return saved ? JSON.parse(saved) : [];
  });

  const [vehiclesCob, setVehiclesCob] = useState<Vehicle[]>(() => {
    return parseVehicles(localStorage.getItem('yard_vehicles_cob'));
  });

  const [logsCob, setLogsCob] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('yard_activity_logs_cob');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('yard_theme_mode');
    return (saved as ThemeMode) || 'auto';
  });

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPrismaScannerOpen, setIsPrismaScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<YardTab>('yard');
  const [initialService, setInitialService] = useState<string | undefined>(undefined);
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isYardSelectorOpen, setIsYardSelectorOpen] = useState(false);
  const [showReportSuccess, setShowReportSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

  // Auth Effect
  useEffect(() => {
    // Explicitly check for password recovery hash on mount
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setIsResettingPassword(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Fetch profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setCurrentUser({
              id: session.user.id,
              name: profile?.name || session.user.email?.split('@')[0] || 'Usuário',
              email: session.user.email || '',
              recoveryEmail: profile?.recovery_email || '',
              fingerprintEnabled: profile?.fingerprint_enabled || false,
              createdAt: session.user.created_at
            });
          })
          .catch(err => {
            console.error('Erro ao buscar perfil inicial:', err);
            // Fallback user state
            if (session?.user) {
              setCurrentUser({
                id: session.user.id,
                name: session.user.email?.split('@')[0] || 'Usuário',
                email: session.user.email || '',
                recoveryEmail: '',
                fingerprintEnabled: false,
                createdAt: session.user.created_at
              });
            }
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      } else if (event === 'SIGNED_IN') {
        setIsResettingPassword(false);
      }

      if (session?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setCurrentUser({
              id: session.user.id,
              name: profile?.name || session.user.email?.split('@')[0] || 'Usuário',
              email: session.user.email || '',
              recoveryEmail: profile?.recovery_email || '',
              fingerprintEnabled: profile?.fingerprint_enabled || false,
              createdAt: session.user.created_at
            });
          })
          .catch(err => {
            console.error('Erro no onAuthStateChange profile:', err);
          });
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Data Fetching Effect
  useEffect(() => {
    if (currentUser) {
      const fetchData = async () => {
        try {
          const [v1, v2, v3, v4, vP1, vP2, vP6, vCob] = await Promise.all([
            databaseService.getVehicles('yard'),
            databaseService.getVehicles('yard2'),
            databaseService.getVehicles('yard3'),
            databaseService.getVehicles('yard4'),
            databaseService.getVehicles('yardP1'),
            databaseService.getVehicles('yardP2'),
            databaseService.getVehicles('yardP6'),
            databaseService.getVehicles('yardCob')
          ]);

          setVehicles(v1);
          setVehicles2(v2);
          setVehicles3(v3);
          setVehicles4(v4);
          setVehiclesP1(vP1);
          setVehiclesP2(vP2);
          setVehiclesP6(vP6);
          setVehiclesCob(vCob);

          const [l1, l2, l3, l4, lP1, lP2, lP6, lCob] = await Promise.all([
            databaseService.getLogs('yard'),
            databaseService.getLogs('yard2'),
            databaseService.getLogs('yard3'),
            databaseService.getLogs('yard4'),
            databaseService.getLogs('yardP1'),
            databaseService.getLogs('yardP2'),
            databaseService.getLogs('yardP6'),
            databaseService.getLogs('yardCob')
          ]);

          setLogs(l1);
          setLogs2(l2);
          setLogs3(l3);
          setLogs4(l4);
          setLogsP1(lP1);
          setLogsP2(lP2);
          setLogsP6(lP6);
          setLogsCob(lCob);
        } catch (error) {
          console.error('Erro ao buscar dados do Supabase:', error);
        }
      };

      fetchData();
    }
  }, [currentUser]);

  // Removed duplicated DEFAULT_YARD_OPTIONS as it's now in constants.ts

  const [yardOptions, setYardOptions] = useState(() => {
    const saved = localStorage.getItem('yard_options_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        const existingOptions = parsed.map((id) => {
          return DEFAULT_YARD_OPTIONS.find(def => def.id === id);
        }).filter((o): o is typeof DEFAULT_YARD_OPTIONS[0] => !!o);

        const newOptions = DEFAULT_YARD_OPTIONS.filter(
          def => !existingOptions.some(eo => eo.id === def.id)
        );

        return [...existingOptions, ...newOptions];
      } catch {
        return DEFAULT_YARD_OPTIONS;
      }
    }
    return DEFAULT_YARD_OPTIONS;
  });

  useEffect(() => {
    localStorage.setItem('yard_options_order', JSON.stringify(yardOptions.map(o => o.id)));
  }, [yardOptions]);

  const currentYardLabel = useMemo(() => {
    return yardOptions.find(y => y.id === activeTab)?.label || 'Selecione o Pátio';
  }, [activeTab, yardOptions]);
  
  // Master Clock - Força recalculação de SLAs e Alertas a cada minuto
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Notificações State
  const [notifiedVehicleIds, setNotifiedVehicleIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Sistema de Tema Inteligente
  useEffect(() => {
    const updateTheme = () => {
      if (themeMode === 'auto') {
        const hour = now.getHours();
        setIsDarkMode(hour >= 18 || hour < 7);
      } else {
        setIsDarkMode(themeMode === 'dark');
      }
    };

    updateTheme();
    localStorage.setItem('yard_theme_mode', themeMode);
  }, [themeMode, now]);

  // Sync to localStorage as a cache/backup
  useEffect(() => {
    localStorage.setItem('yard_vehicles', JSON.stringify(vehicles));
    localStorage.setItem('yard_vehicles_2', JSON.stringify(vehicles2));
    localStorage.setItem('yard_vehicles_3', JSON.stringify(vehicles3));
    localStorage.setItem('yard_vehicles_4', JSON.stringify(vehicles4));
    localStorage.setItem('yard_vehicles_p1', JSON.stringify(vehiclesP1));
    localStorage.setItem('yard_vehicles_p2', JSON.stringify(vehiclesP2));
    localStorage.setItem('yard_vehicles_p6', JSON.stringify(vehiclesP6));
    localStorage.setItem('yard_vehicles_cob', JSON.stringify(vehiclesCob));
  }, [vehicles, vehicles2, vehicles3, vehicles4, vehiclesP1, vehiclesP2, vehiclesP6, vehiclesCob]);

  useEffect(() => {
    localStorage.setItem('yard_activity_logs', JSON.stringify(logs));
    localStorage.setItem('yard_activity_logs_2', JSON.stringify(logs2));
    localStorage.setItem('yard_activity_logs_3', JSON.stringify(logs3));
    localStorage.setItem('yard_activity_logs_4', JSON.stringify(logs4));
    localStorage.setItem('yard_activity_logs_p1', JSON.stringify(logsP1));
    localStorage.setItem('yard_activity_logs_p2', JSON.stringify(logsP2));
    localStorage.setItem('yard_activity_logs_p6', JSON.stringify(logsP6));
    localStorage.setItem('yard_activity_logs_cob', JSON.stringify(logsCob));
  }, [logs, logs2, logs3, logs4, logsP1, logsP2, logsP6, logsCob]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'> & { id?: string }) => {
    const id = toast.id || Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { ...toast, id } as Toast]);
    setTimeout(() => {
      removeToast(id);
    }, 8000);
  }, [removeToast]);

  // Monitoramento de Notificações e Alertas Críticos
  useEffect(() => {
    const checkReadyVehicles = (vList: Vehicle[], yardName: string) => {
      vList.forEach(v => {
        // Regra: Veículo Pronto há mais de 2 horas
        if (v.washStatus === 'Veículo Pronto' && !notifiedVehicleIds.has(v.id)) {
          const hoursInStatus = differenceInHours(now, new Date(v.statusChangedAt || v.entryTime));
          
          if (hoursInStatus >= 2) {
            // Browser Notification (if permission granted)
            if (notificationPermission === 'granted') {
              new Notification('Atenção: Logística de Pátio', {
                body: `O veículo ${v.model} (${v.plate}) está pronto há ${hoursInStatus}h no pátio ${yardName}. Favor liberar a vaga ${v.slotIndex + 1}.`,
                icon: 'https://cdn-icons-png.flaticon.com/512/1165/1165936.png',
                tag: `ready-${v.id}`
              });
            }

            // Toast Notification
            addToast({
              title: 'Otimização de Vaga',
              message: `O veículo ${v.model} (${v.plate}) está pronto há ${hoursInStatus}h. Sugerimos a liberação da vaga ${v.slotIndex + 1} (${yardName}).`,
              type: 'warning'
            });

            setNotifiedVehicleIds(prev => new Set(prev).add(v.id));
          }
        }
      });
    };

    const yardPools = [
      { name: 'Principal', vehicles: vehicles },
      { name: 'Garagem Estiva', vehicles: vehicles2 },
      { name: '1º Andar', vehicles: vehicles3 },
      { name: '1ª Fábrica', vehicles: vehicles4 },
      { name: 'Pátio P1', vehicles: vehiclesP1 },
      { name: 'Pátio P2', vehicles: vehiclesP2 },
      { name: 'Pátio P6', vehicles: vehiclesP6 },
      { name: 'Cobertura', vehicles: vehiclesCob }
    ];

    yardPools.forEach(pool => checkReadyVehicles(pool.vehicles, pool.name));
  }, [
    vehicles, vehicles2, vehicles3, vehicles4, vehiclesP1, vehiclesP2, vehiclesP6, vehiclesCob,
    notificationPermission, notifiedVehicleIds, now, addToast
  ]);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Erro ao ativar tela cheia: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Realtime Subscriptions
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('vehicles_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        (payload) => {
          const eventType = payload.eventType;
          const newDoc = payload.new as Record<string, unknown>;
          const oldDoc = payload.old as Record<string, unknown>;

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const vehicle = databaseService.mapVehicleFromDb(newDoc as Parameters<typeof databaseService.mapVehicleFromDb>[0]);
            const yardId = vehicle.yardId;

            // 1. Update State Sync
            const updater = (prev: Vehicle[]) => {
              // If it's an exit, remove from active list
              if (vehicle.exitTime) return prev.filter(v => v.id !== vehicle.id);
              
              const exists = prev.some(v => v.id === vehicle.id);
              if (exists) {
                return prev.map(v => v.id === vehicle.id ? vehicle : v);
              }
              return [...prev, vehicle];
            };

            if (yardId === 'yard') setVehicles(updater);
            else if (yardId === 'yard2') setVehicles2(updater);
            else if (yardId === 'yard3') setVehicles3(updater);
            else if (yardId === 'yard4') setVehicles4(updater);
            else if (yardId === 'yardP1') setVehiclesP1(updater);
            else if (yardId === 'yardP2') setVehiclesP2(updater);
            else if (yardId === 'yardP6') setVehiclesP6(updater);
            else if (yardId === 'yardCob') setVehiclesCob(updater);

            // 2. Notification Logic for 'Veículo Pronto'
            // Trigger if it's an UPDATE and status changed to Ready, or a new record already in Ready state
            const isNowReady = vehicle.washStatus === 'Veículo Pronto' && (
              eventType === 'INSERT' || 
              (eventType === 'UPDATE' && oldDoc && oldDoc.wash_status !== 'Veículo Pronto')
            );

            if (isNowReady) {
              const isConsultant = currentUser.name.toLowerCase() === vehicle.consultant?.toLowerCase();
              const slotName = vehicle.slotIndex + 1;
              const yardLabel = yardOptions.find(y => y.id === yardId)?.label || 'Pátio';
              
              addToast({
                title: isConsultant ? 'Seu Veículo está Pronto!' : 'Veículo Pronto para Entrega',
                message: `O veículo ${vehicle.model} (${vehicle.plate}) na vaga ${slotName} (${yardLabel}) está pronto para entrega.`,
                type: 'success'
              });

              if (notificationPermission === 'granted') {
                try {
                  const notificationTitle = isConsultant ? '🏁 Seu Veículo está Pronto!' : '🏁 Veículo Pronto: ' + vehicle.plate;
                  const notificationBody = `${vehicle.model} • Vaga ${slotName} (${yardLabel})\nStatus: PRONTO PARA ENTREGA${isConsultant ? '\nFavor entrar em contato com o cliente.' : ''}`;
                  
                  new Notification(notificationTitle, {
                    body: notificationBody,
                    icon: 'https://cdn-icons-png.flaticon.com/512/1165/1165936.png',
                    tag: `ready-${vehicle.id}`
                  });
                } catch (e) {
                  console.error('Realtime notification error:', e);
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, yardOptions, addToast, notificationPermission]);

  const cycleTheme = () => {
    const modes: ThemeMode[] = ['auto', 'light', 'dark'];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setThemeMode(modes[nextIndex]);
  };

  const currentVehicles = useMemo(() => {
    if (activeTab === 'yard') return vehicles;
    if (activeTab === 'yard2') return vehicles2;
    if (activeTab === 'yard3') return vehicles3;
    if (activeTab === 'yard4') return vehicles4;
    if (activeTab === 'yardP1') return vehiclesP1;
    if (activeTab === 'yardP2') return vehiclesP2;
    if (activeTab === 'yardP6') return vehiclesP6;
    if (activeTab === 'yardCob') return vehiclesCob;
    return vehicles;
  }, [activeTab, vehicles, vehicles2, vehicles3, vehicles4, vehiclesP1, vehiclesP2, vehiclesP6, vehiclesCob]);

  const currentLogs = useMemo(() => {
    if (activeTab === 'yard') return logs;
    if (activeTab === 'yard2') return logs2;
    if (activeTab === 'yard3') return logs3;
    if (activeTab === 'yard4') return logs4;
    if (activeTab === 'yardP1') return logsP1;
    if (activeTab === 'yardP2') return logsP2;
    if (activeTab === 'yardP6') return logsP6;
    if (activeTab === 'yardCob') return logsCob;
    return logs;
  }, [activeTab, logs, logs2, logs3, logs4, logsP1, logsP2, logsP6, logsCob]);

  const criticalVehicles = useMemo(() => {
    return currentVehicles.filter(v => {
      try {
        // Replaced parseISO with new Date
        const hoursStayed = differenceInHours(now, new Date(v.entryTime));
        return hoursStayed >= ALERT_THRESHOLDS.SEVERE;
      } catch {
        return false;
      }
    });
  }, [currentVehicles, now]);

  const occupancyStats = useMemo(() => {
    const currentMaxSlots = activeTab === 'yardCob' ? MAX_SLOTS_COBERTURA : (activeTab === 'yardP6' ? MAX_SLOTS_P6 : (activeTab === 'yardP2' ? MAX_SLOTS_P2 : (activeTab === 'yardP1' ? MAX_SLOTS_P1 : (activeTab === 'yard4' ? MAX_SLOTS_1ST_FACTORY : (activeTab === 'yard3' ? MAX_SLOTS_1ST_FLOOR : (activeTab === 'yard2' ? MAX_SLOTS_FACTORY : MAX_SLOTS))))));
    const count = currentVehicles.length;
    const percentage = (count / currentMaxSlots) * 100;
    const colorClass = percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-orange-500' : 'bg-emerald-500';
    const textClass = percentage >= 90 ? 'text-red-500' : percentage >= 70 ? 'text-orange-500' : 'text-emerald-500';
    return { count, percentage, colorClass, textClass, formatted: percentage.toFixed(0) + '%', maxSlots: currentMaxSlots };
  }, [currentVehicles, activeTab]);

  const handlePrismaScan = (data: { number: number; color: string }) => {
    // Search for vehicle in all yards
    const allYards = [
      { id: 'yard', vehicles },
      { id: 'yard2', vehicles: vehicles2 },
      { id: 'yard3', vehicles: vehicles3 },
      { id: 'yard4', vehicles: vehicles4 },
      { id: 'yardP1', vehicles: vehiclesP1 },
      { id: 'yardP2', vehicles: vehiclesP2 },
      { id: 'yardP6', vehicles: vehiclesP6 },
      { id: 'yardCob', vehicles: vehiclesCob }
    ];

    let foundVehicle: Vehicle | null = null;
    let foundYardId: string | null = null;

    for (const yard of allYards) {
      const v = yard.vehicles.find(v => 
        v.prisma.number === data.number && 
        v.prisma.color.toLowerCase() === data.color.toLowerCase()
      );
      if (v) {
        foundVehicle = v;
        foundYardId = yard.id;
        break;
      }
    }

    if (foundVehicle && foundYardId) {
      setActiveTab(foundYardId as YardTab);
      setSelectedSlot(foundVehicle.slotIndex);
      setIsFormOpen(true);
      setIsPrismaScannerOpen(false);
      addToast({
        title: 'Prisma Localizado',
        message: `O Prisma #${data.number} já está em uso na vaga ${foundVehicle.slotIndex + 1} (${DEFAULT_YARD_OPTIONS.find(o => o.id === foundYardId)?.label}).`,
        type: 'info'
      });
    } else {
      // Find first empty slot in current yard
      const currentMaxSlots = activeTab === 'yardCob' ? MAX_SLOTS_COBERTURA : (activeTab === 'yardP6' ? MAX_SLOTS_P6 : (activeTab === 'yardP2' ? MAX_SLOTS_P2 : (activeTab === 'yardP1' ? MAX_SLOTS_P1 : (activeTab === 'yard4' ? MAX_SLOTS_1ST_FACTORY : (activeTab === 'yard3' ? MAX_SLOTS_1ST_FLOOR : (activeTab === 'yard2' ? MAX_SLOTS_FACTORY : MAX_SLOTS))))));
      let firstEmpty = -1;
      for (let i = 0; i < currentMaxSlots; i++) {
        if (!currentVehicles.find(v => v.slotIndex === i)) {
          firstEmpty = i;
          break;
        }
      }

      if (firstEmpty !== -1) {
        setInitialService(undefined);
        setSelectedSlot(firstEmpty);
        setIsFormOpen(true);
        setIsPrismaScannerOpen(false);
        addToast({
          title: 'Novo Registro',
          message: `Prisma #${data.number} pronto para novo registro no ${currentYardLabel}.`,
          type: 'success'
        });
      } else {
        addToast({
          title: 'Pátio Lotado',
          message: `Não há vagas no ${currentYardLabel}. Selecione outro pátio ou libere uma vaga.`,
          type: 'error'
        });
      }
    }
  };

  const handleSaveVehicle = async (vehicle: Vehicle) => {
    const allYardPools = [
      { id: 'yard', setter: setVehicles, logSetter: setLogs },
      { id: 'yard2', setter: setVehicles2, logSetter: setLogs2 },
      { id: 'yard3', setter: setVehicles3, logSetter: setLogs3 },
      { id: 'yard4', setter: setVehicles4, logSetter: setLogs4 },
      { id: 'yardP1', setter: setVehiclesP1, logSetter: setLogsP1 },
      { id: 'yardP2', setter: setVehiclesP2, logSetter: setLogsP2 },
      { id: 'yardP6', setter: setVehiclesP6, logSetter: setLogsP6 },
      { id: 'yardCob', setter: setVehiclesCob, logSetter: setLogsCob },
    ];

    const yardPools = [
      { id: 'yard', vehicles: vehicles, setter: setVehicles, logSetter: setLogs },
      { id: 'yard2', vehicles: vehicles2, setter: setVehicles2, logSetter: setLogs2 },
      { id: 'yard3', vehicles: vehicles3, setter: setVehicles3, logSetter: setLogs3 },
      { id: 'yard4', vehicles: vehicles4, setter: setVehicles4, logSetter: setLogs4 },
      { id: 'yardP1', vehicles: vehiclesP1, setter: setVehiclesP1, logSetter: setLogsP1 },
      { id: 'yardP2', vehicles: vehiclesP2, setter: setVehiclesP2, logSetter: setLogsP2 },
      { id: 'yardP6', vehicles: vehiclesP6, setter: setVehiclesP6, logSetter: setLogsP6 },
      { id: 'yardCob', vehicles: vehiclesCob, setter: setVehiclesCob, logSetter: setLogsCob },
    ];

    // Find where the vehicle currently is in the UI
    const currentPool = yardPools.find(p => p.vehicles.some(v => v.id === vehicle.id));
    
    // Determine where it SHOULD be
    // If we're on a dashboard/tasks tab, it stays where it is, or goes to 'yard' if new.
    // If we're on a specific yard tab, it goes to that yard.
    let targetYardId: YardTab;
    if (activeTab === 'dashboard' || activeTab === 'tasks' || activeTab === 'idleHistory') {
      targetYardId = (currentPool?.id as YardTab) || 'yard';
    } else {
      targetYardId = activeTab;
    }

    try {
      await databaseService.saveVehicle(vehicle, targetYardId);
    } catch (error) {
      console.error('Erro crítico ao salvar no Supabase:', error);
      addToast({ 
        title: 'ERRO NA GRAVAÇÃO', 
        message: 'O servidor não respondeu. Tente novamente ou verifique sua conexão.', 
        type: 'error' 
      });
      // Don't close form if save failed? 
      // For now we still proceed locally but showing a louder error
    }

    const nowISO = new Date().toISOString();
    const existingVehicle = currentPool?.vehicles.find(v => v.id === vehicle.id);
    const existsInAnyPool = !!currentPool;
    
    // Handle status change tracking
    if (existingVehicle && (existingVehicle.washStatus !== vehicle.washStatus || existingVehicle.deliveryStatus !== vehicle.deliveryStatus)) {
      vehicle.statusChangedAt = nowISO;
      setNotifiedVehicleIds(prev => {
        const next = new Set(prev);
        next.delete(vehicle.id);
        return next;
      });
    } else if (!existsInAnyPool) {
      vehicle.statusChangedAt = nowISO;
    }

    const getYardName = (id: string) => DEFAULT_YARD_OPTIONS.find(o => o.id === id)?.label || 'Pátio';

    // Notification for 'Veículo Pronto'
    if (vehicle.washStatus === 'Veículo Pronto') {
      const isNewlyReady = !existingVehicle || existingVehicle.washStatus !== 'Veículo Pronto';
      if (isNewlyReady) {
        const slotName = vehicle.slotIndex + 1;
        const yardName = getYardName(targetYardId);
        const consultantInfo = vehicle.consultant ? ` (Consultor: ${vehicle.consultant})` : '';
        
        addToast({
          title: 'Status: Veículo Pronto',
          message: `O veículo ${vehicle.model} (${vehicle.plate}) na vaga ${slotName} no ${yardName} agora está pronto.${consultantInfo}`,
          type: 'success'
        });

        // Trigger native notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Veículo Pronto', {
            body: `${vehicle.model} (${vehicle.plate}) na vaga ${slotName} (${yardName}) está pronto para entrega.`,
            icon: '/favicon.ico'
          });
        }
      }
    }

    const logAction: 'entry' | 'status_change' | 'exit' = existsInAnyPool ? 'status_change' : 'entry';
    const logDetails = existsInAnyPool 
      ? `Atualização: ${vehicle.washStatus} | ${vehicle.deliveryStatus}` 
      : `Entrada registrada na vaga ${vehicle.slotIndex + 1}`;

    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plate,
      vehicleModel: vehicle.model,
      prismaNumber: vehicle.prisma.number,
      prismaColor: vehicle.prisma.color,
      action: logAction,
      timestamp: nowISO,
      details: logDetails,
      yardId: targetYardId,
      yardName: getYardName(targetYardId),
      serviceType: vehicle.service
    };

    databaseService.saveLog(newLog, targetYardId).catch(console.error);

    vehicle.yardId = targetYardId;

    // 1. Remove from OLD pool if it moved
    if (currentPool && currentPool.id !== targetYardId) {
      currentPool.setter(prev => prev.filter(v => v.id !== vehicle.id));
    }

    // 2. Add or Update in TARGET pool
    const targetPool = allYardPools.find(p => p.id === targetYardId);
    if (targetPool) {
      targetPool.logSetter(prev => [newLog, ...prev]);
      targetPool.setter(prev => {
        const exists = prev.some(v => v.id === vehicle.id);
        if (exists) {
          return prev.map(v => v.id === vehicle.id ? vehicle : v);
        }
        return [...prev, vehicle];
      });
    }

    setIsFormOpen(false);
    setSelectedSlot(null);
  };

  const handleRemoveVehicle = async (id: string, manualExitTime?: string, idleReason?: string, idleActions?: string) => {
    let exitDate: Date;
    try {
      exitDate = manualExitTime ? new Date(manualExitTime) : new Date();
      if (isNaN(exitDate.getTime())) exitDate = new Date();
    } catch {
      exitDate = new Date();
    }
    const exitTime = exitDate.toISOString();

    const vehicle = allActiveVehicles.find(v => v.id === id);
    if (!vehicle) {
      addToast({ title: 'Erro', message: 'Veículo não encontrado ou já removido.', type: 'error' });
      return;
    }

    // 2. Identify which yard this vehicle belongs to
    const yardPools = [
      { id: 'yard', vehicles: vehicles, setter: setVehicles, logSetter: setLogs },
      { id: 'yard2', vehicles: vehicles2, setter: setVehicles2, logSetter: setLogs2 },
      { id: 'yard3', vehicles: vehicles3, setter: setVehicles3, logSetter: setLogs3 },
      { id: 'yard4', vehicles: vehicles4, setter: setVehicles4, logSetter: setLogs4 },
      { id: 'yardP1', vehicles: vehiclesP1, setter: setVehiclesP1, logSetter: setLogsP1 },
      { id: 'yardP2', vehicles: vehiclesP2, setter: setVehiclesP2, logSetter: setLogsP2 },
      { id: 'yardP6', vehicles: vehiclesP6, setter: setVehiclesP6, logSetter: setLogsP6 },
      { id: 'yardCob', vehicles: vehiclesCob, setter: setVehiclesCob, logSetter: setLogsCob },
    ];

    const sourcePool = yardPools.find(p => p.vehicles.some(v => v.id === id));
    
    if (!sourcePool) {
      addToast({ title: 'Atenção', message: 'Veículo não localizado. Tente atualizar a página.', type: 'warning' });
      setIsFormOpen(false);
      setSelectedSlot(null);
      return;
    }

    const targetYardId = sourcePool.id;
    const getYardName = (yId: string) => DEFAULT_YARD_OPTIONS.find(o => o.id === yId)?.label || 'Pátio';
    
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plate,
      vehicleModel: vehicle.model,
      prismaNumber: vehicle.prisma.number,
      prismaColor: vehicle.prisma.color,
      action: 'exit',
      timestamp: exitTime,
      details: `Saída do pátio (${getYardName(targetYardId)} - Vaga ${vehicle.slotIndex + 1})`,
      duration: `${differenceInHours(exitDate, new Date(vehicle.entryTime))}h`,
      yardId: targetYardId,
      yardName: getYardName(targetYardId),
      serviceType: vehicle.service,
      idleReason: idleReason,
      idleActions: idleActions
    };

    // 3. Persist to Supabase
    try {
      await databaseService.removeVehicle(id, exitTime);
      await databaseService.saveLog(newLog, targetYardId);
    } catch (error) {
      console.error('Erro ao registrar saída no Supabase:', error);
      addToast({ title: 'Sincronização Lenta', message: 'Saída registrada localmente, mas a sincronização com o servidor falhou.', type: 'error' });
    }

    // 4. Update Local State (Functional Updates)
    sourcePool.logSetter(prev => [newLog, ...prev]);
    sourcePool.setter(prev => prev.filter(v => v.id !== id));
    
    setNotifiedVehicleIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    setIsFormOpen(false);
    setSelectedSlot(null);
  };

  const handleUpdateLog = async (logId: string, updates: Partial<ActivityLog>, yardId?: string) => {
    try {
      await databaseService.updateLog(logId, updates);
    } catch (error) {
      console.error('Erro ao atualizar log no Supabase:', error);
    }

    const targetId = yardId || activeTab;
    const setterMap: Record<string, React.Dispatch<React.SetStateAction<ActivityLog[]>>> = {
      'yard': setLogs,
      'yard2': setLogs2,
      'yard3': setLogs3,
      'yard4': setLogs4,
      'yardP1': setLogsP1,
      'yardP2': setLogsP2,
      'yardP6': setLogsP6,
      'yardCob': setLogsCob
    };
    
    const setTargetLogs = setterMap[targetId];
    if (setTargetLogs) {
      setTargetLogs(prev => prev.map(log => log.id === logId ? { ...log, ...updates } : log));
    }
  };

  const handleAddHistoryNote = async (note: string) => {
    if (!historyVehicleId) return;
    
    // Find vehicle in all active vehicles
    const vehicle = allActiveVehicles.find(v => v.id === historyVehicleId);
    if (!vehicle) {
       addToast('Veículo não encontrado para adicionar nota', 'error');
       return;
    }

    const newLog: Omit<ActivityLog, 'id'> = {
      vehicleId: historyVehicleId,
      vehiclePlate: vehicle.plate,
      vehicleModel: vehicle.model,
      action: 'note',
      timestamp: new Date().toISOString(),
      details: note,
      yardId: vehicle.yardId,
      yardName: yardOptions.find(y => y.id === vehicle.yardId)?.label || 'Pátio'
    };

    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .insert([newLog])
        .select();

      if (error) throw error;
      
      const logWithId = data[0] as ActivityLog;
      
      // Update the correct logs state based on yardId
      const setterMap: Record<string, React.Dispatch<React.SetStateAction<ActivityLog[]>>> = {
        'yard': setLogs,
        'yard2': setLogs2,
        'yard3': setLogs3,
        'yard4': setLogs4,
        'yardP1': setLogsP1,
        'yardP2': setLogsP2,
        'yardP6': setLogsP6,
        'yardCob': setLogsCob
      };

      const setter = setterMap[vehicle.yardId];
      if (setter) {
        setter(prev => [logWithId, ...prev]);
      }
      
      addToast('Anotação adicionada com sucesso', 'success');
    } catch (err) {
      console.error('Error adding note:', err);
      addToast('Erro ao salvar anotação', 'error');
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    addToast({ title: 'Bem-vindo', message: `Olá, ${user.name}! Acesso liberado ao YardLogic Pro.`, type: 'success' });
  };

  const findFirstAvailableSlot = useCallback(() => {
    const yards = [
      { id: 'yard' as YardTab, vehicles: vehicles, max: MAX_SLOTS },
      { id: 'yard2' as YardTab, vehicles: vehicles2, max: MAX_SLOTS_FACTORY },
      { id: 'yard3' as YardTab, vehicles: vehicles3, max: MAX_SLOTS_1ST_FLOOR },
      { id: 'yard4' as YardTab, vehicles: vehicles4, max: MAX_SLOTS_1ST_FACTORY },
      { id: 'yardP1' as YardTab, vehicles: vehiclesP1, max: MAX_SLOTS_P1 },
      { id: 'yardP2' as YardTab, vehicles: vehiclesP2, max: MAX_SLOTS_P2 },
      { id: 'yardP6' as YardTab, vehicles: vehiclesP6, max: MAX_SLOTS_P6 },
      { id: 'yardCob' as YardTab, vehicles: vehiclesCob, max: MAX_SLOTS_COBERTURA },
    ];

    for (const yard of yards) {
      for (let i = 0; i < yard.max; i++) {
        if (!yard.vehicles.some(v => v.slotIndex === i)) {
          return { yardId: yard.id, slotIndex: i };
        }
      }
    }
    return null;
  }, [vehicles, vehicles2, vehicles3, vehicles4, vehiclesP1, vehiclesP2, vehiclesP6, vehiclesCob]);

  const findFirstAvailableInYard = useCallback((yardId: YardTab) => {
    const yardConfig = [
      { id: 'yard' as YardTab, vehicles: vehicles, max: MAX_SLOTS },
      { id: 'yard2' as YardTab, vehicles: vehicles2, max: MAX_SLOTS_FACTORY },
      { id: 'yard3' as YardTab, vehicles: vehicles3, max: MAX_SLOTS_1ST_FLOOR },
      { id: 'yard4' as YardTab, vehicles: vehicles4, max: MAX_SLOTS_1ST_FACTORY },
      { id: 'yardP1' as YardTab, vehicles: vehiclesP1, max: MAX_SLOTS_P1 },
      { id: 'yardP2' as YardTab, vehicles: vehiclesP2, max: MAX_SLOTS_P2 },
      { id: 'yardP6' as YardTab, vehicles: vehiclesP6, max: MAX_SLOTS_P6 },
      { id: 'yardCob' as YardTab, vehicles: vehiclesCob, max: MAX_SLOTS_COBERTURA },
    ].find(y => y.id === yardId);

    if (!yardConfig) return null;

    for (let i = 0; i < yardConfig.max; i++) {
      if (!yardConfig.vehicles.some(v => v.slotIndex === i)) {
        return i;
      }
    }
    return null;
  }, [vehicles, vehicles2, vehicles3, vehicles4, vehiclesP1, vehiclesP2, vehiclesP6, vehiclesCob]);

  const handleMoveToYard = (vehicleId: string, targetYardId: string) => {
    const vehicle = allActiveVehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    if (vehicle.yardId === targetYardId) return;

    const availableSlot = findFirstAvailableInYard(targetYardId as YardTab);
    
    if (availableSlot !== null) {
      const updatedVehicle = { ...vehicle, yardId: targetYardId, slotIndex: availableSlot };
      handleSaveVehicle(updatedVehicle);
      
      addToast({
        title: 'Transferência de Pátio',
        message: `Veículo ${vehicle.plate} movido para ${DEFAULT_YARD_OPTIONS.find(o => o.id === targetYardId)?.label}.`,
        type: 'success'
      });
      
      // Mudar para o pátio destino para visualização
      setActiveTab(targetYardId as YardTab);
    } else {
      addToast({
        title: 'Pátio Destino Lotado',
        message: `Não há vagas disponíveis no ${DEFAULT_YARD_OPTIONS.find(o => o.id === targetYardId)?.label}.`,
        type: 'error'
      });
    }
  };

  const yardLayouts = useMemo(() => ({
    yard: YARD_LAYOUT,
    yard2: YARD_LAYOUT_FACTORY,
    yard3: YARD_LAYOUT_1ST_FLOOR,
    yard4: YARD_LAYOUT_1ST_FACTORY,
    yardP1: YARD_LAYOUT_P1,
    yardP2: YARD_LAYOUT_P2,
    yardP6: YARD_LAYOUT_P6,
    yardCob: YARD_LAYOUT_COBERTURA
  }), []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const generatePDFReport = () => {
    const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
    const timestamp = new Date().toLocaleString('pt-BR');
    const totalVehiclesCount = allActiveVehicles.length;
    const avgOccupancy = ((totalVehiclesCount / totalMaxSlots) * 100).toFixed(1);

    // Configurações do Cabeçalho
    doc.setFillColor(10, 11, 16); // Cor escura do sistema
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('YardLogic Pro', 20, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('SISTEMA DE CONTROLE DE PÁTIO PORSCHE', 20, 28);
    doc.text(`Gerado em: ${timestamp}`, 140, 28);

    // Seção de KPIs
    doc.setTextColor(10, 11, 16);
    doc.setFontSize(16);
    doc.text('Indicadores de Performance (Geral)', 20, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [['Métrica', 'Valor', 'Status']],
      body: [
        ['Total de Veículos Ativos', totalVehiclesCount.toString(), 'Operacional'],
        ['Capacidade Total de Vagas', totalMaxSlots.toString(), 'Estático'],
        ['Ocupação Média Global', `${avgOccupancy}%`, Number(avgOccupancy) > 90 ? 'SATURADO' : 'NORMAL'],
        ['Consultores Ativos', (CONSULTANTS ? CONSULTANTS.length : 0).toString(), 'Online']
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });

    // Tabela de Ocupação por Pátio
    doc.text('Ocupação por Unidade (Pátios)', 20, doc.lastAutoTable.finalY + 15);
    
    const yardBody = allYardsData.map(yard => [
      yard.name,
      yard.count,
      yard.maxSlots,
      `${((yard.count / yard.maxSlots) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Pátio', 'Veículos', 'Total Vagas', '% Ocupação']],
      body: yardBody,
      theme: 'grid',
      headStyles: { fillColor: [10, 11, 16] }
    });

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount} - YardLogic v2.8.5 - Confidencial Porsche`, 105, 290, { align: 'center' });
    }

    doc.save(`Relatorio_Patio_Porsche_${new Date().toISOString().split('T')[0]}.pdf`);
    
    setShowReportSuccess(true);
    setTimeout(() => setShowReportSuccess(false), 5000);
  };

  const allActiveVehicles = useMemo(() => [
    ...vehicles, ...vehicles2, ...vehicles3, ...vehicles4, ...vehiclesP1, ...vehiclesP2, ...vehiclesP6, ...vehiclesCob
  ], [vehicles, vehicles2, vehicles3, vehicles4, vehiclesP1, vehiclesP2, vehiclesP6, vehiclesCob]);

  const allLogs = useMemo(() => [
    ...logs, ...logs2, ...logs3, ...logs4, ...logsP1, ...logsP2, ...logsP6, ...logsCob
  ], [logs, logs2, logs3, logs4, logsP1, logsP2, logsP6, logsCob]);

  const allYardsData = useMemo(() => {
    return yardOptions
      .filter(opt => opt.id !== 'tasks' && opt.id !== 'dashboard' && opt.id !== 'idleHistory')
      .map(opt => {
        let count = 0;
        let maxSlots = 0;
        switch (opt.id) {
          case 'yard': count = vehicles.length; maxSlots = MAX_SLOTS; break;
          case 'yard2': count = vehicles2.length; maxSlots = MAX_SLOTS_FACTORY; break;
          case 'yard3': count = vehicles3.length; maxSlots = MAX_SLOTS_1ST_FLOOR; break;
          case 'yard4': count = vehicles4.length; maxSlots = MAX_SLOTS_1ST_FACTORY; break;
          case 'yardP1': count = vehiclesP1.length; maxSlots = MAX_SLOTS_P1; break;
          case 'yardP2': count = vehiclesP2.length; maxSlots = MAX_SLOTS_P2; break;
          case 'yardP6': count = vehiclesP6.length; maxSlots = MAX_SLOTS_P6; break;
          case 'yardCob': count = vehiclesCob.length; maxSlots = MAX_SLOTS_COBERTURA; break;
        }
        return { name: opt.label, count, maxSlots };
      });
  }, [yardOptions, vehicles, vehicles2, vehicles3, vehicles4, vehiclesP1, vehiclesP2, vehiclesP6, vehiclesCob]);

  const totalMaxSlots = MAX_SLOTS + MAX_SLOTS_FACTORY + MAX_SLOTS_1ST_FLOOR + MAX_SLOTS_1ST_FACTORY + MAX_SLOTS_P1 + MAX_SLOTS_P2 + MAX_SLOTS_P6 + MAX_SLOTS_COBERTURA;

  return (
    <>
      {loading ? (
        <div className={`fixed inset-0 z-[2000] flex items-center justify-center ${isDarkMode ? 'bg-[#07080C]' : 'bg-slate-100'}`}>
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        (!currentUser || isResettingPassword || showUserManagement) && (
          <Auth 
            onLogin={handleLogin} 
            isDarkMode={isDarkMode} 
            isResettingPassword={isResettingPassword}
            onResetComplete={() => setIsResettingPassword(false)}
            showAdminManagement={showUserManagement}
            onCloseAdminManagement={() => setShowUserManagement(false)}
          />
        )
      )}
      
      <AnimatePresence>
        {showReportSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-sm"
          >
            <div className={`p-5 rounded-[2rem] shadow-2xl border-2 flex items-center gap-5 backdrop-blur-xl ${isDarkMode ? 'bg-[#161922]/90 border-emerald-500/30' : 'bg-emerald-50/90 border-emerald-200'}`}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/40">
                <i className="fas fa-check text-xl"></i>
              </div>
              <div className="flex flex-col">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Sucesso</span>
                <span className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Relatório Concluído!</span>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">O arquivo PDF foi gerado e baixado.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-700 ${isDarkMode ? 'bg-[#07080C]' : 'bg-[#F2F4F7]'}`}>
      <aside className="no-print w-full md:w-72 bg-[#0A0B10] text-slate-300 flex flex-col p-6 gap-8 shrink-0 shadow-2xl z-50 border-r border-white/5">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between text-white px-2">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col"
            >
              <h1 className="font-outfit font-black text-2xl tracking-tighter leading-none">
                Logística de Pátio <span className="text-blue-500">Porsche</span>
              </h1>
              <span className="text-[7px] font-space font-black uppercase tracking-[0.3em] text-slate-600 mt-1">
                Porsche Workshop System
              </span>
            </motion.div>
            
            {criticalVehicles.length > 0 && (
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <div className="relative bg-red-600 text-white px-3 py-1 rounded-xl text-[11px] font-black shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-400 flex items-center gap-2">
                  <i className="fas fa-biohazard animate-pulse"></i>
                  {criticalVehicles.length}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <Reorder.Group axis="y" values={yardOptions} onReorder={setYardOptions} className="flex flex-col gap-2">
            {yardOptions.map((option) => (
              <DraggableYardItem 
                key={option.id} 
                option={option} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab}
              />
            ))}
          </Reorder.Group>

          <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10 shadow-inner">
             <div className="flex items-center justify-between mb-4">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Notificações Push</span>
               <div className={`w-2.5 h-2.5 rounded-full ${notificationPermission === 'granted' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
             </div>
             <button 
                onClick={requestNotificationPermission}
                disabled={notificationPermission === 'granted'}
                className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${notificationPermission === 'granted' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/40'}`}
             >
               {notificationPermission === 'granted' ? 'Monitoramento Ativo' : 'Ativar Alertas Push'}
             </button>
          </div>

          <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10 shadow-inner">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ocupação Total</span>
              <span className={`text-sm font-black ${occupancyStats.textClass}`}>{occupancyStats.formatted}</span>
            </div>
            <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-1000 ${occupancyStats.colorClass}`} style={{ width: `${occupancyStats.percentage}%` }}></div>
            </div>
            <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-widest">{occupancyStats.count} / {occupancyStats.maxSlots} Vagas</p>
          </div>
        </div>

          <div className="mt-auto pt-8 border-t border-white/5 flex flex-col gap-4">
             <button 
               onClick={handleLogout}
               className="flex items-center gap-4 px-5 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-all border border-red-500/20"
             >
               <i className="fas fa-sign-out-alt"></i> Sair do Sistema
             </button>
             <div className="flex items-center gap-3 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
               <i className="fas fa-shield-alt text-blue-500"></i>
               <span>YardLogic v2.8.5</span>
             </div>
          </div>
      </aside>

      <main className="flex-1 p-3 sm:p-6 md:p-10 overflow-x-hidden overflow-y-auto flex flex-col gap-4 sm:gap-8 min-w-0 print:overflow-visible print:h-auto print:p-0">
        <header className="no-print flex flex-col xl:flex-row xl:items-center justify-between gap-6 sm:gap-8 shrink-0">
          <div className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-blue-600 rounded-full opacity-50"></div>
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`text-3xl sm:text-4xl md:text-5xl font-outfit font-black uppercase tracking-tighter leading-[0.9] mb-2 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
              Logística de <span className="text-blue-600">Pátios</span> <motion.span 
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="opacity-40"
              >Porsche</motion.span>
            </motion.h2>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-white/10 text-blue-400' : 'bg-slate-900 text-white'}`}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                LIVE
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className={`font-space font-bold text-xs uppercase tracking-[0.1em] opacity-40 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Monitoramento em tempo real • Fluxos & SLAs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Seletor de Pátio na Barra Superior */}
            <div className="relative">
              <button 
                onClick={() => setIsYardSelectorOpen(!isYardSelectorOpen)}
                className={`h-11 sm:h-14 px-4 sm:px-8 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-4 font-black text-[9px] sm:text-[10px] uppercase tracking-widest border transition-all hover:scale-105 active:scale-95 shadow-lg ${isDarkMode ? 'bg-[#161922] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
              >
                <i className="fas fa-map-marker-alt text-blue-500"></i>
                <span>{currentYardLabel}</span>
                <i className={`fas fa-chevron-down transition-transform duration-300 ${isYardSelectorOpen ? 'rotate-180' : ''}`}></i>
              </button>

              {isYardSelectorOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsYardSelectorOpen(false)}
                  ></div>
                  <div className={`absolute top-full mt-3 right-0 w-72 rounded-3xl shadow-2xl border z-50 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300 ${isDarkMode ? 'bg-[#161922]/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                    <div className="p-3 flex flex-col gap-1">
                      {yardOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setActiveTab(option.id as YardTab);
                            setIsYardSelectorOpen(false);
                          }}
                          className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all text-left ${activeTab === option.id ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-900/40' : `font-bold ${isDarkMode ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}`}
                        >
                          <i className={`fas ${option.icon} text-base`}></i>
                          <span className="text-[10px] uppercase tracking-widest">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={() => setIsPrismaScannerOpen(true)}
              className={`h-11 sm:h-14 px-4 sm:px-8 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-4 font-black text-[9px] sm:text-[10px] uppercase tracking-widest border transition-all hover:scale-105 active:scale-95 shadow-lg ${isDarkMode ? 'bg-blue-600 border-blue-500 text-white shadow-blue-600/20' : 'bg-blue-600 border-blue-500 text-white shadow-blue-600/20'}`}
            >
              <i className="fas fa-qrcode text-base"></i>
              <span className="hidden xs:inline">Identificar</span>
              <span className="xs:hidden">Scanner</span>
            </button>

            <OptimizationSuggestions 
              vehicles={allActiveVehicles}
              activityLogs={allLogs}
              isDarkMode={isDarkMode}
            />

            <button 
              onClick={generatePDFReport}
              className={`h-11 sm:h-14 px-4 sm:px-8 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-4 font-black text-[9px] sm:text-[10px] uppercase tracking-widest border transition-all hover:scale-105 active:scale-95 shadow-lg ${isDarkMode ? 'bg-[#161922] border-white/10 text-emerald-500' : 'bg-white border-slate-200 text-emerald-600'}`}
              title="Gerar Relatório Consolidado (PDF)"
            >
              <i className="fas fa-file-pdf text-base"></i>
              <span className="hidden sm:inline">Relatório</span>
            </button>

            <button 
              onClick={cycleTheme}
              className={`h-11 h-14 px-4 sm:px-8 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-4 font-black text-[9px] sm:text-[10px] uppercase tracking-widest border transition-all hover:scale-105 active:scale-95 shadow-lg ${isDarkMode ? 'bg-[#161922] border-white/10 text-blue-400' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              <i className={`fas ${themeMode === 'auto' ? 'fa-clock' : (themeMode === 'light' ? 'fa-sun' : 'fa-moon')} text-base`}></i>
              <span className="hidden sm:inline">{themeMode === 'auto' ? 'Tema: Auto' : themeMode}</span>
            </button>

            <button 
              onClick={toggleFullscreen}
              className={`w-11 sm:w-14 h-11 sm:h-14 rounded-xl sm:rounded-2xl shadow-lg flex items-center justify-center transition-all active:scale-95 border ${isDarkMode ? 'bg-[#161922] border-white/10 text-slate-400 hover:text-blue-500' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <i className={`fas ${isFullscreen ? 'fa-compress-arrows-alt' : 'fa-expand-arrows-alt'} text-sm sm:text-xl`}></i>
            </button>

            <div className={`hidden lg:flex items-center gap-5 p-4 px-8 rounded-2xl shadow-xl border transition-all ${isDarkMode ? 'bg-[#161922] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-lg">
                  {currentUser?.name.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Usuário</span>
                    {currentUser?.role === 'admin' && (
                      <button 
                        onClick={() => setShowUserManagement(true)}
                        className="text-[8px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md uppercase tracking-widest hover:bg-blue-500 transition-colors"
                      >
                        Config. Cargo
                      </button>
                    )}
                  </div>
                  <span className={`text-[11px] font-black uppercase mt-1 tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{currentUser?.name}</span>
                </div>
              </div>
            </div>

            <div className={`flex items-center gap-5 p-4 px-8 rounded-2xl shadow-xl border transition-all ${isDarkMode ? 'bg-[#161922] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className={`w-3.5 h-3.5 rounded-full animate-pulse ${occupancyStats.percentage > 90 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status de Fluxo</span>
                <span className={`text-[11px] font-black ${occupancyStats.textClass} uppercase mt-1 tracking-tighter`}>{occupancyStats.percentage > 90 ? 'ZONA DE SATURAÇÃO' : 'FLUXO OPERACIONAL'}</span>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 min-h-0 rounded-[1.5rem] sm:rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl border transition-all duration-1000 overflow-hidden print:overflow-visible print:h-auto print:border-none print:shadow-none ${isDarkMode ? 'bg-[#0A0B10] border-white/5' : 'bg-white border-slate-200'}`}>
          {activeTab === 'yard' || activeTab === 'yard2' || activeTab === 'yard3' || activeTab === 'yard4' || activeTab === 'yardP1' || activeTab === 'yardP2' || activeTab === 'yardP6' || activeTab === 'yardCob' ? (
            <YardView 
              vehicles={currentVehicles} 
              activityLogs={currentLogs}
              onSelectSlot={(idx) => { setInitialService(undefined); setSelectedSlot(idx); setIsFormOpen(true); }}
              onViewHistory={setHistoryVehicleId}
              onUpdateVehicle={handleSaveVehicle}
              onUpdateLog={handleUpdateLog}
              onRemoveVehicle={handleRemoveVehicle}
              onMoveToYard={handleMoveToYard}
              isDarkMode={isDarkMode}
              selectedSlotIndex={selectedSlot}
              now={now}
              layout={activeTab === 'yardCob' ? YARD_LAYOUT_COBERTURA : (activeTab === 'yardP6' ? YARD_LAYOUT_P6 : (activeTab === 'yardP2' ? YARD_LAYOUT_P2 : (activeTab === 'yardP1' ? YARD_LAYOUT_P1 : (activeTab === 'yard4' ? YARD_LAYOUT_1ST_FACTORY : (activeTab === 'yard3' ? YARD_LAYOUT_1ST_FLOOR : (activeTab === 'yard2' ? YARD_LAYOUT_FACTORY : YARD_LAYOUT))))))}
              layoutId={activeTab}
              maxSlots={activeTab === 'yardCob' ? MAX_SLOTS_COBERTURA : (activeTab === 'yardP6' ? MAX_SLOTS_P6 : (activeTab === 'yardP2' ? MAX_SLOTS_P2 : (activeTab === 'yardP1' ? MAX_SLOTS_P1 : (activeTab === 'yard4' ? MAX_SLOTS_1ST_FACTORY : (activeTab === 'yard3' ? MAX_SLOTS_1ST_FLOOR : (activeTab === 'yard2' ? MAX_SLOTS_FACTORY : MAX_SLOTS))))))}
              addToast={addToast}
            />
          ) : activeTab === 'tasks' ? (
            <ConsultantTaskBoard 
              vehicles={allActiveVehicles}
              onUpdateVehicle={handleSaveVehicle}
              isDarkMode={isDarkMode}
            />
          ) : activeTab === 'idleHistory' ? (
            <IdleHistory 
              allLogs={allLogs}
              onUpdateLog={handleUpdateLog}
              isDarkMode={isDarkMode}
            />
          ) : activeTab === 'keyBoard' ? (
            <KeyBoard 
              vehicles={allActiveVehicles}
              yardOptions={yardOptions}
              yardLayouts={yardLayouts}
              isDarkMode={isDarkMode}
            />
          ) : activeTab === 'overview' ? (
            <OperationsOverview 
              vehicles={allActiveVehicles}
              activityLogs={allLogs}
              isDarkMode={isDarkMode}
              onEntryClick={(predefinedService) => {
                const available = findFirstAvailableSlot();
                if (available) {
                  setInitialService(predefinedService);
                  setActiveTab(available.yardId);
                  setSelectedSlot(available.slotIndex);
                  setIsFormOpen(true);
                } else {
                  addToast({
                    title: 'Pátio Lotado',
                    message: 'Não há vagas disponíveis em nenhum dos pátios cadastrados.',
                    type: 'error'
                  });
                }
              }}
              onExitClick={(v) => {
                setInitialService(undefined);
                setActiveTab(v.yardId as YardTab);
                setSelectedSlot(v.slotIndex);
                setIsFormOpen(true);
              }}
            />
          ) : activeTab === 'criticalReport' ? (
            <CriticalCasesReport
              isDarkMode={isDarkMode}
            />
          ) : (
            <Dashboard 
              vehicles={allActiveVehicles} 
              activityLogs={allLogs} 
              isDarkMode={isDarkMode} 
              maxSlots={totalMaxSlots}
              allYardsData={allYardsData}
              onYardClick={(yardName) => {
                const found = yardOptions.find(o => o.label === yardName);
                if (found) setActiveTab(found.id as YardTab);
              }}
            />
          )}
        </div>
      </main>

      {isPrismaScannerOpen && (
        <PrismaScanner 
          onScan={handlePrismaScan}
          onClose={() => setIsPrismaScannerOpen(false)}
          isDarkMode={isDarkMode}
        />
      )}

      <AnimatePresence>
        {isFormOpen && selectedSlot !== null && (
          <VehicleForm
            slotIndex={selectedSlot}
            initialService={initialService}
            existingVehicle={currentVehicles.find(v => v.slotIndex === selectedSlot)}
            allActiveVehicles={allActiveVehicles}
            onSave={handleSaveVehicle}
            onRemove={handleRemoveVehicle}
            onClose={() => { setIsFormOpen(false); setSelectedSlot(null); setInitialService(undefined); }}
            isDarkMode={isDarkMode}
            addToast={addToast}
          />
        )}
      </AnimatePresence>

      {historyVehicleId && (
        <VehicleHistory
          vehicleId={historyVehicleId}
          vehicleModel={allActiveVehicles.find(v => v.id === historyVehicleId)?.model || "Veículo"}
          logs={allLogs}
          onClose={() => setHistoryVehicleId(null)}
          onAddNote={handleAddHistoryNote}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
    
    {/* Toast Container */}
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          className={`pointer-events-auto w-80 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex gap-4 items-start ${
            isDarkMode 
              ? 'bg-[#161922]/90 border-white/10 text-white' 
              : 'bg-white/90 border-slate-200 text-slate-900'
          }`}
        >
          <div className={`mt-1 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            toast.type === 'warning' ? 'bg-orange-500/20 text-orange-500' : 
            toast.type === 'error' ? 'bg-red-500/20 text-red-500' :
            toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' :
            'bg-blue-500/20 text-blue-500'
          }`}>
            <i className={`fas ${
              toast.type === 'warning' ? 'fa-exclamation-triangle' : 
              toast.type === 'error' ? 'fa-times-circle' :
              toast.type === 'success' ? 'fa-check-circle' :
              'fa-info-circle'
            } text-lg`}></i>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="font-black text-[11px] uppercase tracking-widest">{toast.title}</h4>
            <p className="text-xs font-medium opacity-70 leading-relaxed">{toast.message}</p>
            <button 
              onClick={() => removeToast(toast.id)}
              className="mt-2 text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors text-left"
            >
              Dispensar
            </button>
          </div>
        </motion.div>
      ))}
    </div>
    </>
  );
};

export default App;
