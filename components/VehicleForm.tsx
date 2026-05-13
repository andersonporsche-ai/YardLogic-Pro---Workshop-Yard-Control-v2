
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle, ConsultantName, WashStatus, DeliveryStatus } from '../types';
import { CONSULTANTS, PRISMA_COLORS, PORSCHE_MODELS, WORKSHOP_SERVICES, WASH_STATUS_OPTIONS, DELIVERY_STATUS_OPTIONS, getSlotDisplayName, ALERT_THRESHOLDS, DEFAULT_YARD_OPTIONS } from '../constants';
import { differenceInMinutes } from 'date-fns';
import { extractLicensePlate, correctPlateWithAI, getCompletionEstimation } from '../services/geminiService';
import { getSmartRecommendation } from '../services/yardOptimization';
import { databaseService } from '../services/database';
import PrismaScanner from './PrismaScanner';

interface VehicleFormProps {
  slotIndex: number;
  initialService?: string;
  existingVehicle?: Vehicle;
  allActiveVehicles?: Vehicle[];
  onSave: (vehicle: Vehicle) => void;
  onRemove?: (id: string, exitTime?: string, idleReason?: string, idleActions?: string) => void;
  onClose: () => void;
  isDarkMode?: boolean;
  addToast?: (toast: { title: string; message: string; type: 'info' | 'warning' | 'error' | 'success' }) => void;
}

const DRAFT_STORAGE_KEY = 'vehicle_form_draft';

const VehicleForm: React.FC<VehicleFormProps> = ({ slotIndex, initialService, existingVehicle, allActiveVehicles, onSave, onRemove, onClose, isDarkMode = false, addToast }) => {
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isPrismaScannerOpen, setIsPrismaScannerOpen] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cameraCapabilities, setCameraCapabilities] = useState<MediaTrackCapabilities | null>(null);
  const [isFramingStable, setIsFramingStable] = useState(false);
  const [isPlateCentered, setIsPlateCentered] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimation, setEstimation] = useState<{ estimatedTime: string; completionTime: string | null; reasoning: string } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const toggleTorch = () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const nextTorch = !isTorchOn;
      if (track.applyConstraints) {
        track.applyConstraints({ advanced: [{ torch: nextTorch }] as MediaTrackConstraintSet[] })
          .then(() => setIsTorchOn(nextTorch))
          .catch(err => console.warn("Torch not supported:", err));
      }
    }
  };

  const [manualExitDate, setManualExitDate] = useState('');
  const [manualExitTime, setManualExitTime] = useState('');
  const [idleReason, setIdleReason] = useState('');
  const [idleActions, setIdleActions] = useState('');
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    id: Math.random().toString(36).substr(2, 9).toUpperCase(),
    plate: '',
    registrationTime: '',
    entryTime: '',
    exitTime: '',
    model: '',
    customer: '',
    service: WORKSHOP_SERVICES[0],
    consultant: '' as ConsultantName,
    washStatus: 'Não Solicitado',
    deliveryStatus: 'Aguardando Liberação',
    slotIndex: slotIndex,
    keyId: '',
    prisma: { number: 0, color: PRISMA_COLORS[0].hex }
  });

  // Update formData if initialService is provided for a new vehicle
  useEffect(() => {
    if (initialService && !existingVehicle) {
      setFormData(prev => ({
        ...prev,
        service: initialService,
        washStatus: (initialService === 'Veículos Seminovos' || initialService === 'PDI') ? initialService : prev.washStatus
      }));
    }
  }, [initialService, existingVehicle]);

  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [plateScanResult, setPlateScanResult] = useState<'none' | 'success' | 'error'>('none');

  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // Load draft on mount if not editing existing vehicle
  useEffect(() => {
    if (!existingVehicle) {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        try {
          const parsedDraft = JSON.parse(savedDraft);
          // Check if it's actually "dirty" (has meaningful data)
          const hasData = parsedDraft.plate || parsedDraft.model || parsedDraft.customer || (parsedDraft.prisma && parsedDraft.prisma.number > 0);
          
          if (hasData) {
            setFormData(prev => ({
              ...prev,
              ...parsedDraft,
              slotIndex: slotIndex // Priority to current slot context
            }));
            setIsDraftRestored(true);
          }
        } catch (e) {
          console.error("Failed to parse vehicle draft:", e);
        }
      }
    }
  }, [existingVehicle, slotIndex]);

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setIsDraftRestored(false);
    // Reset to initial state
    setFormData({
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      plate: '',
      registrationTime: '',
      entryTime: '',
      exitTime: '',
      model: '',
      customer: '',
      service: WORKSHOP_SERVICES[0],
      consultant: '' as ConsultantName,
      washStatus: 'Não Solicitado',
      deliveryStatus: 'Aguardando Liberação',
      slotIndex: slotIndex,
      keyId: '',
      prisma: { number: 0, color: PRISMA_COLORS[0].hex }
    });
  };

  // Save draft whenever formData changes
  useEffect(() => {
    if (!existingVehicle) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    }
  }, [formData, existingVehicle]);

  useEffect(() => {
    if (existingVehicle) {
      setFormData(existingVehicle);
    }
  }, [existingVehicle]);

  const getConsultantInfo = (name?: ConsultantName) => {
    if (!name) return { number: '?', firstName: 'N/A' };
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
    return yiq >= 128 ? 'text-slate-950' : 'text-white';
  };

  const getSLAInfo = () => {
    if (!existingVehicle?.entryTime) return null;
    
    const now = new Date();
    const entryDate = new Date(existingVehicle.entryTime);
    const totalMinutes = differenceInMinutes(now, entryDate);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    let colorClass = 'text-emerald-500';
    let barColor = 'bg-emerald-500';
    let label = 'Operação Eficaz';

    if (hours >= ALERT_THRESHOLDS.SEVERE) {
      colorClass = 'text-red-500';
      barColor = 'bg-red-500';
      label = 'SLA Excedido';
    } else if (hours >= ALERT_THRESHOLDS.CRITICAL) {
      colorClass = 'text-orange-500';
      barColor = 'bg-orange-500';
      label = 'Atenção Crítica';
    } else if (hours >= ALERT_THRESHOLDS.WARNING) {
      colorClass = 'text-amber-500';
      barColor = 'bg-amber-500';
      label = 'Alerta de Prazo';
    }

    const progress = Math.min((totalMinutes / (ALERT_THRESHOLDS.SEVERE * 60)) * 100, 100);

    return {
      formatted: `${hours}h ${minutes}m`,
      colorClass,
      barColor,
      label,
      progress
    };
  };

  const handleOpenConfirmExit = () => {
    const now = new Date();
    setManualExitDate(now.toISOString().split('T')[0]);
    setManualExitTime(now.toTimeString().slice(0, 5));
    setShowConfirmExit(true);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      setZoom(1);
      setIsFramingStable(false);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const track = stream.getVideoTracks()[0];
      // Wait a bit for capabilities to be available
      setTimeout(() => {
        if (track.getCapabilities) {
          const caps = track.getCapabilities();
          setCameraCapabilities(caps);
          if (caps.zoom) {
            setZoom(caps.zoom.min || 1);
          }
        }
      }, 500);

      setIsCameraOpen(true);
      
      // Simulate framing stability and centering check
      setTimeout(() => setIsFramingStable(true), 1500);
      setTimeout(() => setIsPlateCentered(true), 2500);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setZoom(value);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track.applyConstraints) {
        track.applyConstraints({ advanced: [{ zoom: value }] as MediaTrackConstraintSet[] }).catch(err => {
          console.warn("Failed to apply zoom:", err);
        });
      }
    }
  };

  const triggerAutoFocus = () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track.applyConstraints) {
        setIsFocusing(true);
        // Toggle focus mode to trigger a refocus
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as MediaTrackConstraintSet[] })
          .then(() => {
            // Visual feedback for focus
            setIsFramingStable(false);
            setIsPlateCentered(false);
            setTimeout(() => {
              setIsFocusing(false);
              setIsFramingStable(true);
            }, 1000);
            setTimeout(() => setIsPlateCentered(true), 1800);
          })
          .catch(err => {
            console.warn("Focus not supported:", err);
            setIsFocusing(false);
          });
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
    setZoom(1);
    setIsTorchOn(false);
    setIsFramingStable(false);
    setIsPlateCentered(false);
  };

  const captureAndProcess = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      // Use original video resolution for maximum detail
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Clear and draw
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Increased quality for better OCR accuracy
      const base64Image = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
      stopCamera();
      await processImageWithGemini(base64Image);
    }
  };

  const processImageWithGemini = async (base64Data: string) => {
    setIsProcessingAI(true);
    setCameraError(null);
    setOcrSuccess(false);
    setPlateScanResult('none');
    
    // Clear plate error before processing
    setErrors(prev => ({ ...prev, plate: '' }));

    try {
      const extractedPlate = await extractLicensePlate(base64Data);

      if (extractedPlate) {
        // AI Driven Correction: 
        // If the plate doesn't match common formats, ask Gemini to correct it based on transit rules
        let finalPlate = extractedPlate;
        
        const cleanExtracted = extractedPlate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const isMercosulBrazil = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(cleanExtracted);
        const isMercosulArg = /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(cleanExtracted);
        const isOldFormat = /^[A-Z]{3}[0-9]{4}$/.test(cleanExtracted);
        
        if (!isMercosulBrazil && !isMercosulArg && !isOldFormat) {
          // If patterns don't match, use AI specifically to correct it
          const corrected = await correctPlateWithAI(extractedPlate);
          if (corrected) finalPlate = corrected;
        }

        const nextData = { ...formData, plate: finalPlate };
        setFormData(nextData);
        
        // Trigger validation with the new plate
        const isValid = validateField('plate', finalPlate, nextData);
        
        if (isValid) {
          setOcrSuccess(true);
          setPlateScanResult('success');
          // Auto-hide success message after 4 seconds
          setTimeout(() => {
            setOcrSuccess(false);
            setPlateScanResult('none');
          }, 4000);
        } else {
          setPlateScanResult('error');
          setCameraError("Placa reconhecida, mas contém erros de validação.");
        }
      } else {
        setPlateScanResult('error');
        setCameraError("Placa não identificada. Aproxime-se mais, use a lanterna e garanta que a placa esteja centralizada e sem reflexos.");
      }
    } catch (err) {
      console.error("AI Processing Error:", err);
      setPlateScanResult('error');
      setCameraError("Falha na comunicação com o serviço de reconhecimento. Verifique sua conexão.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const validateField = (name: string, value: string | number | undefined | null, customFormData?: Partial<Vehicle>) => {
    const data = customFormData || formData;
    let error = '';
    switch (name) {
      case 'plate':
        if (!value) error = 'A placa é obrigatória';
        else if (value.length < 4) error = 'Placa muito curta';
        else if (typeof value === 'string') {
          const normalize = (s: string) => s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const normalizedValue = normalize(value);
          
          // Formatos: ABC1D23 (Brasil), AB123CD (Argentina), ABC1234 (Antigo/Uruguai)
          const isMercosulBrazil = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(normalizedValue);
          const isMercosulArg = /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(normalizedValue);
          const isOldFormat = /^[A-Z]{3}[0-9]{4}$/.test(normalizedValue);

          if (!isMercosulBrazil && !isMercosulArg && !isOldFormat) {
            error = 'Padrão Mercosul ou antigo exigido (Ex: ABC1D23 ou AB123CD)';
          }

          const duplicate = allActiveVehicles?.find(v => 
            normalize(v.plate) === normalizedValue && 
            v.id !== data.id
          );
          if (duplicate) error = 'Esta placa já está registrada em outra vaga ativa no pátio';
        }
        break;
      case 'model':
        if (!value) error = 'O modelo é obrigatório';
        break;
      case 'customer':
        if (!value) error = 'O nome do cliente é obrigatório';
        break;
      case 'prismaNumber':
        if (!value && value !== 0) error = 'O número do prisma é obrigatório';
        else if (value <= 0) error = 'Número inválido';
        else {
          const duplicate = allActiveVehicles?.find(v => 
            v.prisma.number === value && 
            v.prisma.color === formData.prisma?.color &&
            v.id !== data.id
          );
          if (duplicate) {
            const yardName = DEFAULT_YARD_OPTIONS.find(o => o.id === duplicate.yardId)?.label || duplicate.yardId;
            const colorName = PRISMA_COLORS.find(c => c.hex === duplicate.prisma.color)?.name || 'Cor';
            error = `CONFLITO: Prisma ${colorName} #${value} já está no ${yardName} (Vaga ${duplicate.slotIndex + 1})`;
            
            // Trigger a silent but visible alert via toast if available
            if (addToast) {
              addToast({
                title: 'Conflito de Prisma',
                message: `O Prisma ${colorName} #${value} já pertence ao veículo na vaga ${duplicate.slotIndex + 1} (${yardName}).`,
                type: 'error'
              });
            }
          }
        }
        break;
      case 'service':
        if (!value) error = 'O serviço é obrigatório';
        break;
      case 'consultant':
        if (!value) error = 'O consultor é obrigatório';
        break;
      case 'washStatus':
        if (!value) error = 'O status é obrigatório';
        break;
      case 'deliveryStatus':
        if (!value) error = 'O status de entrega é obrigatório';
        else if (['Liberado para Entrega', 'Entregue'].includes(value as string)) {
          const washStatus = name === 'washStatus' ? value : data.washStatus;
          if (['Em Fila', 'Lavando'].includes(washStatus)) {
            error = 'Não é possível liberar/entregar veículo com lavagem pendente ou em execução';
          }
        }
        break;
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return !error;
  };

  const handlePrismaScan = (data: { number: number; color: string }) => {
    const nextData = {
      ...formData,
      prisma: {
        number: data.number,
        color: data.color
      }
    };
    setFormData(nextData);
    validateField('prismaNumber', data.number, nextData);
    setIsPrismaScannerOpen(false);
  };

  const handleEstimateCompletion = async () => {
    if (!formData.model || !formData.service) {
      addToast?.({
        title: 'Dados Incompletos',
        message: 'Preencha o modelo e o serviço para estimar a conclusão.',
        type: 'warning'
      });
      return;
    }
    
    setIsEstimating(true);
    try {
      // Obter logs para análise de histórico se for veículo existente
      let vehicleLogs: ActivityLog[] = [];
      if (existingVehicle) {
        const allLogs = await databaseService.getLogs();
        vehicleLogs = allLogs.filter(l => l.vehicleId === existingVehicle.id);
      }
      
      const result = await getCompletionEstimation(formData as Vehicle, vehicleLogs);
      setEstimation(result);
      
      setFormData(prev => ({
        ...prev,
        estimatedCompletionTime: result.estimatedTime,
        estimationReasoning: result.reasoning
      }));
      
      addToast?.({
        title: 'Estimativa IA Concluída',
        message: `Conclusão prevista: ${result.estimatedTime}`,
        type: 'info'
      });
    } catch (error) {
      console.error("Error estimating:", error);
      addToast?.({
        title: 'Erro na Estimativa',
        message: 'Não foi possível processar a estimativa de IA agora.',
        type: 'error'
      });
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Final Validation
    const isPlateValid = validateField('plate', formData.plate);
    const isModelValid = validateField('model', formData.model);
    const isCustomerValid = validateField('customer', formData.customer);
    const isPrismaValid = validateField('prismaNumber', formData.prisma?.number);
    const isServiceValid = validateField('service', formData.service);
    const isConsultantValid = validateField('consultant', formData.consultant);
    const isWashValid = validateField('washStatus', formData.washStatus);
    const isDeliveryValid = validateField('deliveryStatus', formData.deliveryStatus);

    if (!isPlateValid || !isModelValid || !isCustomerValid || !isPrismaValid || !isServiceValid || !isConsultantValid || !isWashValid || !isDeliveryValid) {
      return;
    }

    // Clear draft on successful save
    localStorage.removeItem(DRAFT_STORAGE_KEY);

    const finalData = { ...formData };
    
    // Record registration time if it's a new entry
    if (!existingVehicle || !finalData.registrationTime) {
      finalData.registrationTime = new Date().toISOString();
    }

    if (!existingVehicle || !finalData.entryTime) {
      finalData.entryTime = new Date().toISOString();
    }
    if (!finalData.plate) {
      finalData.plate = finalData.id || '';
    }
    onSave(finalData as Vehicle);
  };

  const sla = getSLAInfo();
  const consultantInfo = getConsultantInfo(formData.consultant);
  const prismaColor = formData.prisma?.color || '#3b82f6';
  const prismaNumber = formData.prisma?.number || 0;
  const textColor = getContrastColor(prismaColor);
  const isDarkText = textColor === 'text-slate-950';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
    >
      {/* CAMERA OVERLAY */}
      {isCameraOpen && (
        <div className="absolute inset-0 bg-black z-[150] flex flex-col items-center justify-center p-6">
          <div className="relative w-full max-w-lg aspect-[4/3] bg-slate-900 rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {/* Mercosul Guide Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`w-3/4 h-1/3 border-4 rounded-xl shadow-[0_0_0_1000px_rgba(0,0,0,0.5)] transition-all duration-500 relative ${isPlateCentered ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]' : isFocusing ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]' : isFramingStable ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)]' : 'border-blue-500/50'}`}
              >
                {/* Horizontal Scanning Bar */}
                <motion.div 
                  initial={{ top: '0%' }}
                  animate={{ top: '100%', opacity: [0, 1, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)] z-10"
                />

                {/* Corner Markers */}
                <div className={`absolute -top-2 -left-2 w-10 h-10 border-t-4 border-l-4 rounded-tl-xl transition-colors duration-300 ${isPlateCentered ? 'border-emerald-500' : isFocusing ? 'border-white' : isFramingStable ? 'border-amber-400' : 'border-blue-500'}`}></div>
                <div className={`absolute -top-2 -right-2 w-10 h-10 border-t-4 border-r-4 rounded-tr-xl transition-colors duration-300 ${isPlateCentered ? 'border-emerald-500' : isFocusing ? 'border-white' : isFramingStable ? 'border-amber-400' : 'border-blue-500'}`}></div>
                <div className={`absolute -bottom-2 -left-2 w-10 h-10 border-b-4 border-l-4 rounded-bl-xl transition-colors duration-300 ${isPlateCentered ? 'border-emerald-500' : isFocusing ? 'border-white' : isFramingStable ? 'border-amber-400' : 'border-blue-500'}`}></div>
                <div className={`absolute -bottom-2 -right-2 w-10 h-10 border-b-4 border-r-4 rounded-br-xl transition-colors duration-300 ${isPlateCentered ? 'border-emerald-500' : isFocusing ? 'border-white' : isFramingStable ? 'border-amber-400' : 'border-blue-500'}`}></div>
                
                {/* Centered Crosshair / Focus Reticle */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${isFocusing ? 'opacity-100 scale-110' : isFramingStable ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                  <div className={`w-12 h-12 border-2 rounded-full border-dashed animate-spin-slow ${isPlateCentered ? 'border-emerald-500' : isFocusing ? 'border-white' : 'border-amber-400/50'}`}></div>
                  <div className={`w-8 h-px absolute ${isPlateCentered ? 'bg-emerald-500' : isFocusing ? 'bg-white' : 'bg-amber-400/50'}`}></div>
                  <div className={`h-8 w-px absolute ${isPlateCentered ? 'bg-emerald-500' : isFocusing ? 'bg-white' : 'bg-amber-400/50'}`}></div>
                </div>

                {/* Status Label */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap flex flex-col items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-[0.3em] px-5 py-2 rounded-full shadow-lg transition-all duration-500 ${isPlateCentered ? 'bg-emerald-500 text-white scale-110' : isFocusing ? 'bg-white text-slate-900 animate-pulse' : isFramingStable ? 'bg-amber-500 text-white' : 'bg-blue-600/40 text-blue-100 backdrop-blur-md'}`}>
                    {isPlateCentered ? 'Pronto para Capturar' : isFocusing ? 'Estabilizando Foco...' : isFramingStable ? 'Enquadramento Aceitável' : 'Posicione a Placa'}
                  </span>
                </div>

                {/* AI Detection Visual Hints */}
                <div className="absolute top-2 left-2 flex gap-1">
                  <div className={`w-1 h-1 rounded-full ${isPlateCentered ? 'bg-emerald-500' : 'bg-blue-500/30'}`}></div>
                  <div className={`w-1 h-1 rounded-full ${isPlateCentered ? 'bg-emerald-500' : 'bg-blue-500/30'}`}></div>
                </div>
              </motion.div>
            </div>

            {/* Scanning Animation */}
            {!isFramingStable && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-scanner-line"></div>
              </div>
            )}
          </div>
          
          {/* Camera Controls */}
          <div className="w-full max-w-lg mt-6 space-y-6">
            {/* Zoom Slider */}
            {cameraCapabilities?.zoom && (
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                <i className="fas fa-search-minus text-white/40 text-xs"></i>
                <input 
                  type="range"
                  min={cameraCapabilities.zoom.min || 1}
                  max={cameraCapabilities.zoom.max || 5}
                  step="0.1"
                  value={zoom}
                  onChange={handleZoomChange}
                  className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <i className="fas fa-search-plus text-white/40 text-xs"></i>
                <span className="text-[10px] font-black text-white w-8 text-right">{zoom.toFixed(1)}x</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-6">
              <button 
                onClick={stopCamera}
                className="px-5 h-14 rounded-2xl bg-white/5 text-white flex items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-90 border border-white/10"
                title="Cancelar"
              >
                <i className="fas fa-times text-sm"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Sair</span>
              </button>
              
              <button 
                onClick={captureAndProcess}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${isPlateCentered ? 'bg-emerald-600 shadow-emerald-600/40 scale-110' : isFramingStable ? 'bg-blue-600 shadow-blue-600/40' : 'bg-slate-700 shadow-black/40'}`}
                title="Capturar Placa"
              >
                <div className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center">
                  <i className={`fas fa-camera text-2xl text-white ${isPlateCentered ? 'animate-pulse' : ''}`}></i>
                </div>
              </button>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={triggerAutoFocus}
                  className="w-14 h-14 rounded-2xl bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 border border-white/10"
                  title="Re-focar"
                >
                  <i className="fas fa-expand text-lg"></i>
                </button>
                
                {cameraCapabilities?.torch && (
                  <button 
                    onClick={toggleTorch}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 border ${isTorchOn ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-white/5 text-white border-white/10'}`}
                    title="Lanterna"
                  >
                    <i className={`fas ${isTorchOn ? 'fa-lightbulb' : 'fa-bolt'} text-lg`}></i>
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <p className="mt-8 text-white/40 font-black uppercase text-[9px] tracking-[0.4em]">Centralize a placa para melhor precisão</p>
        </div>
      )}

      {/* PRISMA SCANNER OVERLAY */}
      {isPrismaScannerOpen && (
        <PrismaScanner 
          onScan={handlePrismaScan}
          onClose={() => setIsPrismaScannerOpen(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* HIDDEN CANVAS FOR CAPTURE */}
      <canvas ref={canvasRef} className="hidden" />

      {showConfirmExit && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[110] p-6 animate-in fade-in zoom-in-95 duration-200">
           <div className={`${isDarkMode ? 'bg-[#161922] border-white/10' : 'bg-white border-slate-200'} p-8 rounded-3xl border max-w-sm w-full shadow-2xl`}>
              <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <i className="fas fa-sign-out-alt text-xl"></i>
              </div>
              <h4 className={`text-xl font-black mb-2 uppercase text-center ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Registrar Saída Manual</h4>
              <p className="text-slate-500 text-sm mb-8 text-center">Defina o horário de saída para liberar a vaga.</p>
              
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data</label>
                    <input 
                      type="date" 
                      className={`h-11 px-4 rounded-xl border font-bold text-xs outline-none transition-all focus:ring-2 focus:ring-red-500/20 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                      value={manualExitDate}
                      onChange={e => setManualExitDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hora</label>
                    <input 
                      type="time" 
                      className={`h-11 px-4 rounded-xl border font-bold text-xs outline-none transition-all focus:ring-2 focus:ring-red-500/20 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                      value={manualExitTime}
                      onChange={e => setManualExitTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Motivo da Ociosidade (Opcional)</label>
                    <textarea 
                      className={`p-4 rounded-xl border font-bold text-xs outline-none transition-all focus:ring-2 focus:ring-blue-500/20 h-20 resize-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                      placeholder="Ex: Fila de espera, manutenção, reserva..."
                      value={idleReason}
                      onChange={e => setIdleReason(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ações Tomadas (Opcional)</label>
                    <textarea 
                      className={`p-4 rounded-xl border font-bold text-xs outline-none transition-all focus:ring-2 focus:ring-blue-500/20 h-20 resize-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                      placeholder="Ex: Contatado gestor, priorizado reparo..."
                      value={idleActions}
                      onChange={e => setIdleActions(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 mt-2">
                  <button 
                    onClick={() => { 
                      let exitISO = undefined;
                      try {
                        if (manualExitDate && manualExitTime) {
                          const dateObj = new Date(`${manualExitDate}T${manualExitTime}`);
                          if (!isNaN(dateObj.getTime())) {
                            exitISO = dateObj.toISOString();
                          }
                        }
                      } catch (err) {
                        console.error("Erro ao converter data de saída:", err);
                      }
                      onRemove?.(formData.id!, exitISO, idleReason, idleActions); 
                      setShowConfirmExit(false); 
                    }} 
                    className="h-12 bg-red-600 text-white rounded-xl font-black uppercase text-[11px] hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-600/20"
                  >
                    Registrar Saída
                  </button>
                  <button 
                    onClick={() => setShowConfirmExit(false)} 
                    className={`h-12 rounded-xl font-black uppercase text-[11px] transition-colors ${isDarkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`${isDarkMode ? 'bg-[#0F1117] border-white/10' : 'bg-white border-slate-200'} rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden border relative flex flex-col md:flex-row max-h-[98vh] md:max-h-[90vh] mx-2`}
      >
        
        {/* TAG LATERAL - IDENTIFICAÇÃO PREMIUM */}
        <div 
          className={`w-full md:w-24 shrink-0 flex md:flex-col items-center justify-between p-4 sm:p-6 md:py-12 transition-all duration-500 border-b md:border-b-0 md:border-r relative ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}
          style={{ backgroundColor: prismaColor }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none opacity-40"></div>
          
          {/* Prisma Number */}
          <div className={`flex flex-col items-center z-10 ${textColor}`}>
            <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-60 leading-none mb-2">Prisma</span>
            <span className="text-4xl font-black leading-none tabular-nums drop-shadow-md">{prismaNumber || '--'}</span>
          </div>
          
          {/* Consultant Info */}
          <div className={`flex flex-col items-center z-10 md:my-10 ${textColor}`}>
            <div className={`hidden md:block h-px w-8 mb-8 opacity-20 ${isDarkText ? 'bg-black' : 'bg-white'}`}></div>
            <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-60 leading-none mb-2">Consultor</span>
            <span className="text-lg font-black tracking-tighter drop-shadow-sm">#{consultantInfo.number}</span>
          </div>

          {/* Vertical Name */}
          <div className="hidden md:flex items-center justify-center z-10 h-64 relative">
            <span className={`text-[15px] font-black uppercase -rotate-90 origin-center whitespace-nowrap tracking-[0.6em] drop-shadow-lg transition-all duration-500 ${textColor}`}>
              {consultantInfo.firstName}
            </span>
          </div>

          {/* Mobile Name */}
          <div className="md:hidden flex flex-col items-end z-10">
            <span className={`text-[12px] font-black uppercase tracking-[0.25em] drop-shadow-sm ${textColor}`}>{consultantInfo.firstName}</span>
            <span className={`text-[9px] font-black opacity-40 uppercase tracking-tighter ${textColor}`}>#{formData.id?.slice(0, 4)}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-inherit overflow-hidden">
          {/* Header */}
          <div className={`px-5 sm:px-10 py-5 sm:py-8 border-b flex justify-between items-center ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
            <div className="relative">
              <div className="flex items-center gap-3 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <h3 className={`text-xl sm:text-2xl font-black tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {getSlotDisplayName(slotIndex)}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <i className="fas fa-fingerprint text-[9px] text-blue-500"></i>
                  <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{formData.id}</span>
                </div>
                {formData.registrationTime && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <i className="fas fa-calendar-check text-[9px] text-emerald-500"></i>
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                      Registrado: {new Date(formData.registrationTime).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Draft Banner */}
              <AnimatePresence>
                {isDraftRestored && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute -bottom-10 left-0 flex items-center gap-2 px-3 py-1 bg-amber-500 text-white rounded-lg shadow-lg z-20"
                  >
                    <i className="fas fa-history text-[8px]"></i>
                    <span className="text-[8px] font-black uppercase tracking-tighter">Rascunho recuperado</span>
                    <button 
                      onClick={handleDiscardDraft}
                      className="ml-2 hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                      title="Descartar rascunho"
                    >
                      <i className="fas fa-trash-alt text-[7px]"></i>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={onClose} 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white' : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 shadow-sm'}`}
            >
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>

          {/* SLA Monitor */}
          {existingVehicle && sla && (
            <div className={`px-5 sm:px-10 py-4 sm:py-6 border-b flex flex-col gap-3 ${isDarkMode ? 'bg-white/[0.01] border-white/5' : 'bg-white border-slate-100'}`}>
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{sla.label}</span>
                  <div className="flex items-center gap-2">
                    <i className={`fas fa-clock ${sla.colorClass} text-sm animate-pulse`}></i>
                    <span className={`text-xl sm:text-2xl font-black tabular-nums tracking-tighter ${sla.colorClass}`}>{sla.formatted}</span>
                  </div>
                </div>
                
                {/* AI ESTIMATION BUTTON / DISPLAY */}
                <div className="flex flex-col items-end gap-2">
                  {!estimation && !formData.estimatedCompletionTime ? (
                    <button 
                      type="button"
                      onClick={handleEstimateCompletion}
                      disabled={isEstimating}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all active:scale-95 ${isEstimating ? 'bg-blue-500/10 border-blue-500/20 text-blue-500/50' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500'}`}
                    >
                      {isEstimating ? (
                        <i className="fas fa-circle-notch animate-spin text-xs"></i>
                      ) : (
                        <i className="fas fa-magic text-xs"></i>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest">Estimar Conclusão</span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                        <i className="fas fa-robot text-[10px]"></i>
                        <span className="text-[10px] font-black uppercase tracking-wider">Previsão: {estimation?.estimatedTime || formData.estimatedCompletionTime}</span>
                        <button 
                          type="button"
                          onClick={() => setEstimation(null)}
                          className="ml-1 opacity-50 hover:opacity-100"
                        >
                          <i className="fas fa-sync-alt text-[8px]"></i>
                        </button>
                      </div>
                      {estimation?.reasoning && (
                        <p className="mt-1 text-[8px] font-medium text-slate-400 max-w-[150px] text-right italic leading-tight">
                          {estimation.reasoning}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${sla.barColor} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
                  style={{ width: `${sla.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-10">
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Placa / ID do Veículo/Equipamento</label>
                  <div className="relative group flex gap-2">
                    <div className="relative flex-1">
                      <i className="fas fa-id-card absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm transition-colors group-focus-within:text-blue-500"></i>
                      <input 
                        type="text" 
                        placeholder="ABC-1234" 
                        className={`w-full h-14 pl-12 pr-5 rounded-2xl border-2 font-black uppercase transition-all outline-none focus:ring-4 focus:ring-blue-500/10 ${errors.plate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-slate-800 focus:border-blue-500 shadow-sm')}`} 
                        value={formData.plate || ''} 
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          setFormData({ ...formData, plate: val });
                          validateField('plate', val);
                        }} 
                      />

                      {/* AI Feedback Animation Overlay */}
                      <AnimatePresence mode="wait">
                        {plateScanResult !== 'none' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className={`absolute -right-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg z-10 ${
                              plateScanResult === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                            }`}
                          >
                            <motion.i 
                              initial={{ rotate: -45 }}
                              animate={{ rotate: 0 }}
                              className={`fas ${plateScanResult === 'success' ? 'fa-check' : 'fa-exclamation-triangle'} text-lg`}
                            />
                            {/* Pulse effect for success */}
                            {plateScanResult === 'success' && (
                              <motion.div 
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 1.5, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute inset-0 rounded-full bg-emerald-500"
                              />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button 
                      type="button"
                      onClick={startCamera}
                      disabled={isProcessingAI}
                      className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${isProcessingAI ? 'bg-slate-500/20 text-slate-500' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500'}`}
                      title="Tirar foto da placa"
                    >
                      {isProcessingAI ? (
                        <i className="fas fa-circle-notch animate-spin"></i>
                      ) : (
                        <i className="fas fa-camera"></i>
                      )}
                    </button>
                  </div>
                  {errors.plate && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{errors.plate}</p>
                  )}
                  {cameraError && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{cameraError}</p>
                  )}
                  {ocrSuccess && (
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest ml-1 flex items-center gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                      <i className="fas fa-check-circle"></i> Placa reconhecida automaticamente
                    </p>
                  )}
                  {isProcessingAI && !cameraError && (
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1 animate-pulse flex items-center gap-2">
                       <i className="fas fa-microchip animate-spin text-[8px]"></i> IA analisando imagem...
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Modelo / Descrição</label>
                  <div className="relative group">
                    <i className="fas fa-car absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm transition-colors group-focus-within:text-blue-500"></i>
                    <input 
                      list="porsche-models" 
                      placeholder="Selecione o modelo ou descreva o equipamento" 
                      className={`w-full h-14 pl-12 pr-5 rounded-2xl border-2 font-bold transition-all outline-none focus:ring-4 focus:ring-blue-500/10 ${errors.model ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-slate-800 focus:border-blue-500 shadow-sm')}`} 
                      value={formData.model || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({ ...formData, model: val });
                        validateField('model', val);
                      }} 
                    />
                    <datalist id="porsche-models">{PORSCHE_MODELS.map(m => <option key={m} value={m} />)}</datalist>
                  </div>
                  {errors.model && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{errors.model}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Proprietário / Cliente</label>
                  <div className="relative group">
                    <i className="fas fa-user absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm transition-colors group-focus-within:text-blue-500"></i>
                    <input 
                      type="text" 
                      placeholder="Nome completo do cliente" 
                      className={`w-full h-14 pl-12 pr-5 rounded-2xl border-2 font-bold transition-all outline-none focus:ring-4 focus:ring-blue-500/10 ${errors.customer ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-slate-800 focus:border-blue-500 shadow-sm')}`} 
                      value={formData.customer || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({ ...formData, customer: val });
                        validateField('customer', val);
                      }} 
                    />
                  </div>
                  {errors.customer && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{errors.customer}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">ID da Chave Física (QR Code)</label>
                  <div className="relative group">
                    <i className="fas fa-key absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm transition-colors group-focus-within:text-blue-500"></i>
                    <input 
                      type="text" 
                      placeholder="Escaneie ou digite o ID da chave" 
                      className={`w-full h-14 pl-12 pr-5 rounded-2xl border-2 font-bold transition-all outline-none focus:ring-4 focus:ring-blue-500/10 ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-slate-800 focus:border-blue-500 shadow-sm'}`} 
                      value={formData.keyId || ''} 
                      onChange={e => {
                        setFormData({ ...formData, keyId: e.target.value });
                      }} 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Número Prisma</label>
                    <button 
                      type="button"
                      onClick={() => setIsPrismaScannerOpen(true)}
                      className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 hover:text-blue-400 transition-colors"
                    >
                      <i className="fas fa-qrcode"></i> Escanear Prisma
                    </button>
                  </div>
                  <div className={`relative group ${errors.prismaNumber ? 'animate-shake' : ''}`}>
                    <i className={`fas fa-tag absolute left-5 top-1/2 -translate-y-1/2 text-sm transition-colors ${errors.prismaNumber ? 'text-red-500' : 'text-slate-400 group-focus-within:text-blue-500'}`}></i>
                    <input 
                      type="number" 
                      placeholder="00" 
                      className={`w-full h-14 pl-12 pr-5 rounded-2xl border-2 font-black transition-all outline-none focus:ring-4 ${errors.prismaNumber ? 'border-red-500 bg-red-500/5 focus:ring-red-500/20 text-red-600' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50 focus:ring-blue-500/10' : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500 shadow-sm focus:ring-blue-500/10')}`} 
                      value={formData.prisma?.number || ''} 
                      onFocus={(e) => e.target.select()} 
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        const nextData = { ...formData, prisma: { color: formData.prisma?.color || PRISMA_COLORS[0].hex, number: val } };
                        setFormData(nextData);
                        validateField('prismaNumber', val, nextData);
                      }} 
                    />
                  </div>
                  {errors.prismaNumber && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{errors.prismaNumber}</p>
                  )}
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Cor do Prisma</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className={`w-full h-14 px-5 rounded-2xl border-2 flex items-center justify-between transition-all outline-none focus:ring-4 focus:ring-blue-500/10 ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-white border-slate-100 text-slate-800 shadow-sm'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full shadow-inner border border-white/20" style={{ backgroundColor: prismaColor }}></div>
                        <span className="font-bold text-sm tracking-tight">{PRISMA_COLORS.find(c => c.hex === prismaColor)?.name || 'Selecione a Cor'}</span>
                      </div>
                      <i className={`fas fa-chevron-down text-[10px] transition-transform duration-300 ${showColorPicker ? 'rotate-180' : ''}`}></i>
                    </button>
                    
                    <AnimatePresence>
                      {showColorPicker && (
                        <>
                          {/* Backdrop to close the picker */}
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setShowColorPicker(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className={`absolute left-0 right-0 mt-3 p-4 rounded-[1.5rem] border shadow-2xl z-50 ${isDarkMode ? 'bg-[#1A1D26] border-white/10 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'}`}
                          >
                            <div className="grid grid-cols-4 gap-2">
                              {PRISMA_COLORS.map(c => (
                                <button
                                  key={c.hex}
                                  type="button"
                                  onClick={() => {
                                    const nextData = { ...formData, prisma: { color: c.hex, number: formData.prisma?.number || 0 } };
                                    setFormData(nextData);
                                    validateField('prismaNumber', nextData.prisma.number, nextData);
                                    setShowColorPicker(false);
                                  }}
                                  className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all relative ${formData.prisma?.color === c.hex ? (isDarkMode ? 'bg-white/10 border border-white/10' : 'bg-slate-50 border border-slate-100') : 'hover:bg-slate-500/5 border border-transparent'}`}
                                >
                                  <div 
                                    className={`w-10 h-10 rounded-full shadow-lg relative flex items-center justify-center transition-transform hover:scale-110 active:scale-95 group`} 
                                    style={{ backgroundColor: c.hex }}
                                  >
                                    <div className="absolute inset-0 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    {formData.prisma?.color === c.hex && (
                                      <motion.i 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className={`fas fa-check text-xs ${getContrastColor(c.hex)}`}
                                      />
                                    )}
                                  </div>
                                  <span className={`text-[7px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{c.name}</span>
                                  {formData.prisma?.color === c.hex && (
                                    <motion.div 
                                      layoutId="activeColor"
                                      className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center"
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Tipo de Serviço</label>
                  <div className="relative">
                    <select 
                      className={`w-full h-14 px-5 rounded-2xl border-2 font-bold transition-all outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 ${errors.service ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : (isDarkMode ? 'bg-[#1A1D26] border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500 shadow-sm')}`} 
                      value={formData.service} 
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({ ...formData, service: val });
                        validateField('service', val);
                      }}
                    >
                      {WORKSHOP_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <i className="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                  </div>
                  {formData.service && (
                    <AnimatePresence>
                      {(() => {
                        const recommendation = getSmartRecommendation(formData.service);
                        if (!recommendation) return null;
                        return (
                          <motion.div 
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 overflow-hidden"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-5 h-5 rounded-lg bg-blue-500 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5">
                                <i className="fas fa-lightbulb"></i>
                              </div>
                              <div>
                                <p className="text-[8px] font-black uppercase text-blue-500 tracking-wider mb-1">Otimização Logística</p>
                                <p className="text-[9px] font-bold text-slate-500 leading-tight">
                                  {recommendation.description}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  )}
                  {errors.service && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{errors.service}</p>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Consultor Responsável</label>
                  <div className="relative">
                    <select 
                      className={`w-full h-14 px-5 rounded-2xl border-2 font-bold transition-all outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 ${errors.consultant ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : (isDarkMode ? 'bg-[#1A1D26] border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500 shadow-sm')}`} 
                      value={formData.consultant || ''} 
                      onChange={e => {
                        const val = e.target.value as ConsultantName;
                        setFormData({ ...formData, consultant: val });
                        validateField('consultant', val);
                      }}
                    >
                      <option value="" disabled>Selecione o Consultor</option>
                      {CONSULTANTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <i className="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                  </div>
                  {errors.consultant && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{errors.consultant}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Status de Lavagem / Preparação</label>
                  <div className="relative">
                    <select 
                      className={`w-full h-14 px-5 rounded-2xl border-2 font-bold transition-all outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 ${errors.washStatus ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : (isDarkMode ? 'bg-[#1A1D26] border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500 shadow-sm')}`} 
                      value={formData.washStatus} 
                      onChange={e => {
                        const val = e.target.value as WashStatus;
                        const nextData = { ...formData, washStatus: val };
                        setFormData(nextData);
                        validateField('washStatus', val, nextData);
                        validateField('deliveryStatus', formData.deliveryStatus, nextData);
                      }}
                    >
                      {WASH_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <i className="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                  </div>
                  {errors.washStatus && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{errors.washStatus}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Status de Entrega</label>
                  <div className="relative">
                    <select 
                      className={`w-full h-14 px-5 rounded-2xl border-2 font-bold transition-all outline-none appearance-none focus:ring-4 focus:ring-blue-500/10 ${errors.deliveryStatus ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : (isDarkMode ? 'bg-[#1A1D26] border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500 shadow-sm')}`} 
                      value={formData.deliveryStatus} 
                      onChange={e => {
                        const val = e.target.value as DeliveryStatus;
                        setFormData({ ...formData, deliveryStatus: val });
                        validateField('deliveryStatus', val);
                      }}
                    >
                      {DELIVERY_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <i className="fas fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs"></i>
                  </div>
                  {errors.deliveryStatus && (
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 animate-pulse">{errors.deliveryStatus}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col md:flex-row gap-5 pt-6">
                {existingVehicle && (
                  <button 
                    type="button" 
                    onClick={handleOpenConfirmExit} 
                    className={`flex-1 h-16 rounded-[1.25rem] font-black uppercase text-[11px] tracking-[0.2em] transition-all active:scale-95 border-2 flex items-center justify-center gap-3 ${isDarkMode ? 'border-red-500/30 text-red-500 hover:bg-red-500/10' : 'border-red-500 text-red-500 hover:bg-red-50 shadow-sm'}`}
                  >
                    <i className="fas fa-sign-out-alt text-sm"></i> Registrar Saída Manual
                  </button>
                )}
                <button 
                  type="submit" 
                  className="flex-[2] h-16 bg-blue-600 text-white rounded-[1.25rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <i className="fas fa-check-circle text-sm"></i> {existingVehicle ? 'Salvar Alterações' : 'Confirmar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default VehicleForm;
