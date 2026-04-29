
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
  }
];

export const getSmartRecommendation = (serviceType: string): OptimizationRule | undefined => {
  return OPTIMIZATION_RULES.find(rule => 
    rule.serviceTypes.some(type => serviceType.toLowerCase().includes(type.toLowerCase()))
  );
};

export const analyzeYardEfficiency = (vehicles: Vehicle[]) => {
  const misplacedVehicles = vehicles.filter(vehicle => {
    const recommendation = getSmartRecommendation(vehicle.service || '');
    if (!recommendation) return false;
    return !recommendation.preferredYards.includes(vehicle.yardId || 'yard');
  });

  return {
    efficiencyScore: Math.max(0, 100 - (misplacedVehicles.length * 5)),
    misplacedVehicles,
    recommendations: misplacedVehicles.map(v => ({
      vehicleId: v.id,
      plate: v.plate,
      model: v.model,
      currentYard: v.yardId,
      suggestedYards: getSmartRecommendation(v.service || '')?.preferredYards || []
    }))
  };
};
