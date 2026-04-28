
export type ConsultantName = 
  | 'Nelson Yoshikazu'
  | 'Rafael Perreira'
  | 'Thiago Paixão'
  | 'Alexandre da Costa'
  | 'Mirian'
  | 'Gabriel Alex';

export interface Prisma {
  number: number;
  color: string;
}

export type WashStatus = 
  | 'Não Solicitado' 
  | 'Em Fila' 
  | 'Lavando' 
  | 'Finalizado' 
  | 'Veículo Imobilizado'
  | 'Veículo Pronto'
  | 'Veículos Seminovos'
  | 'Veículo Blindado'
  | 'Aguardando Peças'
  | 'Teste Driver'
  | 'PDI'
  | 'Approved'
  | 'PPF'
  | 'Reset Pos Blindagem'
  | 'Veículos Diretoria'
  | 'Veículos Clássicos'
  | 'Veículos PBR';

export type DeliveryStatus = 
  | 'Aguardando Liberação' 
  | 'Liberado para Entrega' 
  | 'Entregue' 
  | 'Cancelado';

export interface ActivityLog {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  prismaNumber?: number;
  prismaColor?: string;
  action: 'entry' | 'exit' | 'status_change' | 'consultant_change';
  timestamp: string;
  details: string;
  duration?: string; // Tempo formatado (ex: "4h 30m")
  idleReason?: string; // Motivo da ociosidade (preenchido manualmente)
  idleActions?: string; // Ações tomadas (preenchido manualmente)
  yardId?: string;
  yardName?: string;
}

export interface IdleLog {
  id: string;
  slotIndex: number;
  yardId: string;
  yardName: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  reason?: string;
  actions?: string;
}

export interface Vehicle {
  id: string;
  plate: string; // Placa ou ID Visível do Veículo
  registrationTime: string; // ISO string - Horário exato do registro inicial
  entryTime: string; // ISO string
  statusChangedAt: string; // ISO string - Rastreia quando o status atual foi definido
  exitTime?: string; // ISO string (opcional)
  model: string;
  customer: string;
  prisma: Prisma;
  consultant: ConsultantName;
  service: string;
  washStatus: WashStatus;
  deliveryStatus: DeliveryStatus;
  slotIndex: number; // 0-n
  yardId: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // In a real app, this would be hashed
  recoveryEmail: string;
  fingerprintEnabled: boolean;
  createdAt: string;
}

export interface YardStats {
  totalOccupied: number;
  totalAvailable: number;
  avgStayTime: number; // in hours
  consultantLoad: Record<ConsultantName, number>;
}
