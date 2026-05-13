
import { ConsultantName, WashStatus, DeliveryStatus } from './types';

export const CONSULTANTS: ConsultantName[] = [
  'Nelson Yoshikazu',
  'Rafael Perreira',
  'Thiago Paixão',
  'Alexandre da Costa',
  'Mirian',
  'Gabriel Alex'
];

export const CONSULTANT_EMAILS: Record<ConsultantName, string> = {
  'Nelson Yoshikazu': 'nelson@yardlogicpro.com',
  'Rafael Perreira': 'rafael@yardlogicpro.com',
  'Thiago Paixão': 'thiago@yardlogicpro.com',
  'Alexandre da Costa': 'alexandre@yardlogicpro.com',
  'Mirian': 'mirian@yardlogicpro.com',
  'Gabriel Alex': 'gabriel@yardlogicpro.com'
};

export const WASH_STATUS_OPTIONS: WashStatus[] = [
  'Não Solicitado',
  'Reset Pos Blindagem',
  'Veículos Diretoria',
  'Veículos Clássicos',
  'Teste Driver',
  'Veículos PBR',
  'Em Fila',
  'Lavando',
  'Finalizado',
  'Veículo Imobilizado',
  'Veículo Pronto',
  'Veículos Seminovos',
  'Veículo Blindado',
  'Aguardando Peças',
  'PDI',
  'Approved',
  'PPF'
];

export const DELIVERY_STATUS_OPTIONS: DeliveryStatus[] = [
  'Aguardando Liberação',
  'Liberado para Entrega',
  'Entregue',
  'Cancelado'
];

export const PRISMA_COLORS = [
  { "name": "Vermelho", "hex": "#ef4444" },
  { "name": "Azul", "hex": "#3b82f6" },
  { "name": "Verde", "hex": "#22c55e" },
  { "name": "Amarelo", "hex": "#eab308" },
  { "name": "Laranja", "hex": "#f97316" },
  { "name": "Roxo", "hex": "#a855f7" },
  { "name": "Cinza", "hex": "#64748b" }
];

export const PORSCHE_MODELS = [
  'Porsche 911 Carrera',
  'Porsche 911 Targa',
  'Porsche 911 Turbo',
  'Porsche 911 GT3',
  'Porsche 911 GT3 RS',
  'Porsche 718 Custom',
  'Porsche 718 Cayman',
  'Porsche 718 Boxster',
  'Porsche 718 Spyder',
  'Porsche Taycan',
  'Porsche Taycan Cross Turismo',
  'Porsche Panamera',
  'Porsche Macan',
  'Porsche Macan Electric',
  'Porsche Cayenne',
  'Porsche Cayenne Coupé'
];

export const WORKSHOP_SERVICES = [
  'Reset Pos Blindagem',
  'Veículos Diretoria',
  'Veículos Clássicos',
  'Teste Driver',
  'Veículos PBR',
  'Revisão Periódica (Check-list)',
  'Troca de Óleo e Filtros',
  'Troca de Pastilhas/Discos de Freio',
  'Alinhamento e Balanceamento',
  'Diagnóstico Eletrônico (Scanner)',
  'Serviço de Ar Condicionado',
  'Reparo de Suspensão',
  'Substituição de Bateria',
  'Reparo Elétrico/Iluminação',
  'Troca de Pneus',
  'Limpeza de Bicos Injetores',
  'Troca de Fluido de Transmissão',
  'Reparo de Motor',
  'Recall de Fábrica',
  'Instalação de Acessórios',
  'Polimento e Estética',
  'Veículos Seminovos',
  'PDI / Veículos Seminovos',
  'PDI',
  'PPF'
];

// Configuração expandida do pátio com etiquetas funcionais
export const YARD_LAYOUT = [
  { row: 'A', slots: 2, label: 'Vagas de Veiculos Zero', icon: 'fa-truck' },
  { row: 'B', slots: 2, label: 'Vagas de Veiculos Zero', icon: 'fa-truck' },
  { row: 'C', slots: 3, label: 'Teste Driver', icon: 'fa-truck' },
  { row: 'D', slots: 5, label: 'Vagas de Pós Vendas', icon: 'fa-truck' },
  { row: 'E', slots: 5, label: 'Vagas de Pós Vendas', icon: 'fa-truck' },
  { row: 'F', slots: 5, label: 'Vagas de Pós Vendas', icon: 'fa-truck' },
  { row: 'G', slots: 5, label: 'Vagas de Pós Vendas', icon: 'fa-truck' },
  { row: 'H', slots: 5, label: 'Vagas de Pós Vendas', icon: 'fa-truck' },
  { row: 'I', slots: 5, label: 'Vagas de Veiculo 0k', icon: 'fa-truck' },
  { row: 'J', slots: 5, label: 'Vagas de Veiculo 0k', icon: 'fa-truck' },
  { row: 'K', slots: 5, label: 'Vagas Veiculos Semi novos', icon: 'fa-truck' },
  { row: 'L', slots: 5, label: 'Vagas Veiculos Semi novos', icon: 'fa-truck' },
  { row: 'M', slots: 5, label: 'Vagas de Pós Vendas', icon: 'fa-truck' }
];

export const YARD_LAYOUT_FACTORY = [
  { row: 'A', slots: 6, label: 'Vagas Sub Solo Factory', yardRow: 0, icon: 'fa-industry' },
  { row: 'B', slots: 6, label: 'Vagas Sub Solo Factory', yardRow: 0, icon: 'fa-industry' },
  { row: 'C', slots: 6, label: 'Vagas Sub Solo Factory', yardRow: 0, icon: 'fa-industry' },
  { row: 'D', slots: 2, label: 'Vagas Sub Solo Factory', yardRow: 0, marginLeft: '400px', icon: 'fa-industry' }
];

export const YARD_LAYOUT_1ST_FLOOR = [
  { row: 'A', slots: 5, label: 'Pátio 1° Piso Factory', icon: 'fa-stairs' },
  { row: 'B', slots: 4, label: 'Pátio 1° Piso Factory', icon: 'fa-stairs' },
  { row: 'C', slots: 1, label: 'Box 1', icon: 'fa-box' },
  { row: 'D', slots: 1, label: 'Box 2', icon: 'fa-box' },
  { row: 'E', slots: 1, label: 'Box 3', icon: 'fa-box' }
];

export const YARD_LAYOUT_1ST_FACTORY = [
  { row: 'A', slots: 1, label: '3° Piso Factory', verticalGroup: 'A-F', yardRow: 0, icon: 'fa-building' },
  { row: 'CORR1', slots: 0, isCorridor: true, verticalGroup: 'A-F', yardRow: 0 },
  { row: 'C', slots: 1, label: '3° Piso Factory', verticalGroup: 'A-F', yardRow: 0, icon: 'fa-building' },
  { row: 'D', slots: 1, label: '3° Piso Factory', verticalGroup: 'A-F', yardRow: 0, icon: 'fa-building' },
  { row: 'CORR4', slots: 0, isCorridor: true, verticalGroup: 'A-F', yardRow: 0 },
  { row: 'E', slots: 1, label: '3° Piso Factory', verticalGroup: 'A-F', yardRow: 0, icon: 'fa-building' },
  { row: 'F', slots: 1, label: '3° Piso Factory', verticalGroup: 'A-F', yardRow: 0, icon: 'fa-building' },
  { row: 'CORR2', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'B', slots: 1, label: '3° Piso Factory', yardRow: 0, icon: 'fa-building' },
  { row: 'G', slots: 1, label: '3° Piso Factory', yardRow: 1, marginTop: '80px', icon: 'fa-building' },
  { row: 'H', slots: 1, label: '3° Piso Factory', yardRow: 1, marginTop: '80px', icon: 'fa-building' },
  { row: 'CORR3', slots: 0, isCorridor: true, yardRow: 1, marginTop: '80px' },
  { row: 'I', slots: 1, label: '3° Piso Factory', yardRow: 1, marginTop: '80px', icon: 'fa-building' },
  { row: 'J', slots: 1, label: '3° Piso Factory', yardRow: 1, marginTop: '80px', icon: 'fa-building' },
  { row: 'L', slots: 1, label: '3° Piso Factory', yardRow: 1, marginTop: '80px', icon: 'fa-building' },
  { row: 'K', slots: 1, label: '3° Piso Factory', yardRow: 1, marginTop: '-560px', icon: 'fa-building' }
];

export const YARD_LAYOUT_P1 = [
  { row: 'A', slots: 1, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'B', slots: 1, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'C', slots: 1, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'D', slots: 1, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'E', slots: 2, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'F', slots: 2, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'G', slots: 2, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'H', slots: 2, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'I', slots: 2, label: 'Pátio P1', icon: 'fa-parking' },
  { row: 'J', slots: 2, label: 'Pátio P1', icon: 'fa-parking' }
];

export const YARD_LAYOUT_P2 = [
  { row: 'A', slots: 2, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'B', slots: 3, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'C', slots: 3, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'D', slots: 3, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'E', slots: 3, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'F', slots: 3, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'G', slots: 3, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'H', slots: 3, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'I', slots: 3, label: 'Pátio P2', icon: 'fa-parking' },
  { row: 'J', slots: 3, label: 'Pátio P2', icon: 'fa-parking' }
];

export const YARD_LAYOUT_P6 = [
  // Corredores Superiores
  { row: 'CORR_P6_A', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_B', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_C', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_D', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_E', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_F', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_G', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_H', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_I', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_J', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_K', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_L', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_M', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_N', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_O', slots: 0, isCorridor: true, yardRow: 0 },
  { row: 'CORR_P6_P', slots: 0, isCorridor: true, yardRow: 0 },

  // Vagas Adicionais Superior Direito
  { row: 'Q', slots: 1, label: 'Pátio P6', yardRow: 0, marginLeft: '60px', icon: 'fa-map-pin' },

  // Vagas (A-P)
  { row: 'A', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'B', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'C', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'D', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'E', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'F', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'G', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'H', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'I', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'J', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'K', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'L', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'M', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'N', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'O', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'P', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', icon: 'fa-map-pin' },
  { row: 'R', slots: 1, label: 'Pátio P6', yardRow: 1, marginTop: '20px', marginLeft: '60px', icon: 'fa-map-pin' }
];

export const YARD_LAYOUT_COBERTURA = [
  { row: 'A', slots: 1, label: 'Fila Vertical A', yardRow: 0, icon: 'fa-warehouse' },
  { row: 'B', slots: 2, label: 'Fila Vertical B', yardRow: 0, icon: 'fa-warehouse' },
  { row: 'C', slots: 2, label: 'Fila Vertical C', yardRow: 0, icon: 'fa-warehouse' },
  { row: 'D', slots: 2, label: 'Fila Vertical D', yardRow: 0, icon: 'fa-warehouse' },
  { row: 'E', slots: 2, label: 'Fila Vertical E', yardRow: 2, marginTop: '80px', icon: 'fa-warehouse' },
  { row: 'CORR_A', slots: 0, isCorridor: true, yardRow: 1, marginTop: '40px' },
  { row: 'CORR_B', slots: 0, isCorridor: true, yardRow: 1, marginTop: '40px' },
  { row: 'CORR_C', slots: 0, isCorridor: true, yardRow: 1, marginTop: '40px' },
  { row: 'CORR_D', slots: 0, isCorridor: true, yardRow: 1, marginTop: '40px' },
  { row: 'CORR_E', slots: 0, isCorridor: true, yardRow: 1, marginTop: '40px' }
];

export const MAX_SLOTS = YARD_LAYOUT.reduce((acc, row) => acc + row.slots, 0);
export const MAX_SLOTS_FACTORY = YARD_LAYOUT_FACTORY.reduce((acc, row) => acc + row.slots, 0);
export const MAX_SLOTS_1ST_FLOOR = YARD_LAYOUT_1ST_FLOOR.reduce((acc, row) => acc + row.slots, 0);
export const MAX_SLOTS_1ST_FACTORY = YARD_LAYOUT_1ST_FACTORY.reduce((acc, row) => acc + row.slots, 0);
export const MAX_SLOTS_P1 = YARD_LAYOUT_P1.reduce((acc, row) => acc + row.slots, 0);
export const MAX_SLOTS_P2 = YARD_LAYOUT_P2.reduce((acc, row) => acc + row.slots, 0);
export const MAX_SLOTS_P6 = YARD_LAYOUT_P6.reduce((acc, row) => acc + row.slots, 0);
export const MAX_SLOTS_COBERTURA = YARD_LAYOUT_COBERTURA.reduce((acc, row) => acc + row.slots, 0);

export const ALERT_THRESHOLDS = {
  WARNING: 24,
  CRITICAL: 100,
  SEVERE: 168
};

export const DEFAULT_YARD_OPTIONS = [
  { id: 'overview', label: 'Overview', icon: 'fa-stream' },
  { id: 'keyBoard', label: 'Quadro de Chaves', icon: 'fa-key' },
  { id: 'dashboard', label: 'Visão Geral', icon: 'fa-chart-pie' },
  { id: 'yard', label: 'Sub Solo Matriz', icon: 'fa-th-large' },
  { id: 'yard2', label: 'Sub Solo Factory', icon: 'fa-th-large' },
  { id: 'yard3', label: 'Pátio 3', icon: 'fa-warehouse' },
  { id: 'yard4', label: '3° Piso Factory', icon: 'fa-th-large' },
  { id: 'yardP1', label: 'Pátio P1', icon: 'fa-th-large' },
  { id: 'yardP2', label: 'Pátio P2', icon: 'fa-th-large' },
  { id: 'yardP6', label: 'Pátio P6', icon: 'fa-th-large' },
  { id: 'yardCob', label: 'Cobertura Oficina', icon: 'fa-warehouse' },
  { id: 'tasks', label: 'Tarefas', icon: 'fa-tasks' },
  { id: 'idleHistory', label: 'Histórico Ociosidade', icon: 'fa-user-clock' },
  { id: 'criticalReport', label: 'Casos Críticos', icon: 'fa-exclamation-circle' },
  { id: 'performanceReport', label: 'Desempenho', icon: 'fa-chart-line' },
];

export const getSlotDisplayName = (index: number, row?: string, col?: number): string => {
  if (index >= 11 && index <= 30) {
    return `Pós Vendas ${row || ''}${col || ''}`;
  }
  if (row && col) {
    return `${row}${col}`;
  }
  return `Vaga ${index + 1}`;
};
