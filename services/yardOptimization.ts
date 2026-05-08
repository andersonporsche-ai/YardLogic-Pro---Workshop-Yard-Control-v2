
import { Vehicle } from '../types';

export type ServiceZone = 'FAST' | 'MEDIUM' | 'HEAVY' | 'PREMIUM' | 'SPECIAL';

export interface OptimizationRule {
  serviceTypes: string[];
  preferredYards: string[];
  preferredSlots?: number[];
  description: string;
}

export const OPTIMIZATION_RULES: OptimizationRule[] = [
  {
    serviceTypes: ['Lavagem', 'Entrega', 'Serviço Rápido'],
    preferredYards: ['yard', 'yardP6'],
    description: 'Veículos de giro rápido devem ser mantidos no Sub Solo Matriz ou P6 para acesso imediato.'
  },
  {
    serviceTypes: ['Revisão', 'Mecânica', 'PDI'],
    preferredYards: ['yard2', 'yard3', 'yard4'],
    description: 'Serviços técnicos de média duração são ideais para as áreas da Factory ou 1º Andar.'
  },
  {
    serviceTypes: ['Funilaria', 'Pintura', 'Blindagem'],
    preferredYards: ['yardCob', 'yardP2'],
    description: 'Serviços de longa permanência devem ocupar a Cobertura ou Pátio P2 para não obstruir o fluxo central.'
  },
  {
    serviceTypes: ['Detalhamento', 'Polimento'],
    preferredYards: ['yardCob'],
    description: 'Serviços de estética sensíveis devem ser mantidos em área coberta.'
  },
  {
    serviceTypes: ['CRITICAL_STAY'],
    preferredYards: ['yardP6'],
    description: 'Veículos com estadia superior a 48 horas devem ser movidos para o Setor P6 para liberar vagas produtivas.'
  }
];

export const getSmartRecommendation = (serviceType: string, stayHours?: number): OptimizationRule | undefined => {
  if (stayHours && stayHours >= 48) {
    return OPTIMIZATION_RULES.find(rule => rule.serviceTypes.includes('CRITICAL_STAY'));
  }
  return OPTIMIZATION_RULES.find(rule => 
    rule.serviceTypes.some(type => serviceType.toLowerCase().includes(type.toLowerCase()))
  );
};

export const analyzeYardEfficiency = (vehicles: Vehicle[]) => {
  const now = new Date();
  
  const misplacedVehicles = vehicles.filter(vehicle => {
    const entry = new Date(vehicle.entryTime);
    const stayHours = Math.abs(now.getTime() - entry.getTime()) / 36e5;
    
    const recommendation = getSmartRecommendation(vehicle.service || '', stayHours);
    if (!recommendation) return false;
    return !recommendation.preferredYards.includes(vehicle.yardId || 'yard');
  });

  const criticalRelocations = vehicles
    .filter(v => {
      const entry = new Date(v.entryTime);
      const stayHours = Math.abs(now.getTime() - entry.getTime()) / 36e5;
      return stayHours >= 48 && v.yardId !== 'yardP6';
    })
    .map(v => ({
      vehicleId: v.id,
      plate: v.plate,
      model: v.model,
      currentYard: v.yardId,
      stayHours: Math.floor(Math.abs(now.getTime() - new Date(v.entryTime).getTime()) / 36e5),
      suggestedYard: 'yardP6'
    }))
    .sort((a, b) => b.stayHours - a.stayHours)
    .slice(0, 2);

  return {
    efficiencyScore: Math.max(0, 100 - (misplacedVehicles.length * 5)),
    misplacedVehicles,
    criticalRelocations,
    recommendations: misplacedVehicles.map(v => {
      const entry = new Date(v.entryTime);
      const stayHours = Math.abs(now.getTime() - entry.getTime()) / 36e5;
      const rec = getSmartRecommendation(v.service || '', stayHours);
      
      return {
        vehicleId: v.id,
        plate: v.plate,
        model: v.model,
        currentYard: v.yardId,
        suggestedYards: rec?.preferredYards || []
      };
    })
  };
};
