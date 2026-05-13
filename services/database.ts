
import { supabase } from './supabase';
import { Vehicle, ActivityLog } from '../types';

export const databaseService = {
  // Vehicles
  async getVehicles(yardId?: string) {
    let query = supabase.from('vehicles').select('*').is('exit_time', null);
    if (yardId) {
      query = query.eq('yard_id', yardId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(this.mapVehicleFromDb);
  },

  async getAllActiveVehicles() {
    const { data, error } = await supabase.from('vehicles').select('*').is('exit_time', null);
    if (error) throw error;
    return (data || []).map(this.mapVehicleFromDb);
  },

  async getAllVehicles() {
    const { data, error } = await supabase.from('vehicles').select('*');
    if (error) throw error;
    return (data || []).map(this.mapVehicleFromDb);
  },

  async saveVehicle(vehicle: Vehicle, yardId: string) {
    const dbVehicle = this.mapVehicleToDb(vehicle, yardId);
    const { error } = await supabase.from('vehicles').upsert(dbVehicle);
    if (error) throw error;
  },

  async removeVehicle(id: string, exitTime: string) {
    const { error } = await supabase
      .from('vehicles')
      .update({ exit_time: exitTime })
      .eq('id', id);
    if (error) throw error;
  },

  // Logs
  async getLogs(yardId?: string, limit = 100) {
    let query = supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(limit);
    if (yardId) {
      query = query.eq('yard_id', yardId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(this.mapLogFromDb);
  },

  async saveLog(log: ActivityLog, yardId: string) {
    const dbLog = this.mapLogToDb(log, yardId);
    const { error } = await supabase.from('logs').insert([dbLog]);
    if (error) throw error;
  },

  async updateLog(logId: string, updates: Partial<ActivityLog>) {
    const dbUpdates: Record<string, string | null | undefined> = {};
    if (updates.idleReason !== undefined) dbUpdates.idle_reason = updates.idleReason;
    if (updates.idleActions !== undefined) dbUpdates.idle_actions = updates.idleActions;
    if (updates.details !== undefined) dbUpdates.details = updates.details;
    
    const { error } = await supabase.from('logs').update(dbUpdates).eq('id', logId);
    if (error) throw error;
  },

  // Helpers
  mapLogToDb(l: ActivityLog, yardId: string) {
    return {
      id: l.id,
      vehicle_id: l.vehicleId,
      vehicle_plate: l.vehiclePlate,
      vehicle_model: l.vehicleModel,
      prisma_number: l.prismaNumber,
      prisma_color: l.prismaColor,
      action: l.action,
      timestamp: l.timestamp,
      details: l.details,
      duration: l.duration,
      idle_reason: l.idleReason,
      idle_actions: l.idleActions,
      yard_id: l.yardId || yardId,
      yard_name: l.yardName || ''
    };
  },

  mapLogFromDb(l: {
    id: string;
    vehicle_id: string;
    vehicle_plate: string;
    vehicle_model: string;
    prisma_number?: number;
    prisma_color?: string;
    action: 'entry' | 'exit' | 'status_change' | 'consultant_change';
    timestamp: string;
    details: string;
    duration?: string;
    idle_reason?: string;
    idle_actions?: string;
    yard_id: string;
    yard_name: string;
  }): ActivityLog {
    return {
      id: l.id,
      vehicleId: l.vehicle_id,
      vehiclePlate: l.vehicle_plate,
      vehicleModel: l.vehicle_model,
      prismaNumber: l.prisma_number,
      prismaColor: l.prisma_color,
      action: l.action,
      timestamp: l.timestamp,
      details: l.details,
      duration: l.duration,
      idleReason: l.idle_reason,
      idleActions: l.idle_actions,
      yardId: l.yard_id,
      yardName: l.yard_name
    };
  },
  mapVehicleToDb(v: Vehicle, yardId: string) {
    // Ensure required fields have fallbacks to prevent Supabase NOT NULL constraint errors
    const now = new Date().toISOString();
    return {
      id: v.id,
      plate: v.plate || 'SEM-PLACA',
      registration_time: v.registrationTime || v.entryTime || now,
      entry_time: v.entryTime || now,
      status_changed_at: v.statusChangedAt || v.entryTime || now,
      exit_time: v.exitTime && v.exitTime.trim() !== '' ? v.exitTime : null,
      model: v.model || 'Não Informado',
      customer: v.customer || 'Não Informado',
      prisma_number: v.prisma?.number || 0,
      prisma_color: v.prisma?.color || '#3b82f6',
      consultant: v.consultant || 'Gabriel Alex', // Default fallback
      service: v.service || 'Mecânica Geral',
      wash_status: v.washStatus || 'Não Solicitado',
      delivery_status: v.deliveryStatus || 'Aguardando Liberação',
      slot_index: v.slotIndex ?? 0,
      yard_id: yardId || v.yardId || 'yard',
      estimated_completion_time: v.estimatedCompletionTime,
      estimation_reasoning: v.estimationReasoning
    };
  },

  mapVehicleFromDb(v: {
    id: string;
    plate: string;
    registration_time: string;
    entry_time: string;
    status_changed_at: string;
    exit_time: string | null;
    model: string;
    customer: string;
    prisma_number: number;
    prisma_color: string;
    consultant: string;
    service: string;
    wash_status: string;
    delivery_status: string;
    slot_index: number;
    yard_id: string;
    estimated_completion_time?: string;
    estimation_reasoning?: string;
  }): Vehicle {
    const now = new Date().toISOString();
    return {
      id: v.id,
      plate: v.plate,
      registrationTime: v.registration_time || v.entry_time || now,
      entryTime: v.entry_time || now,
      statusChangedAt: v.status_changed_at || v.entry_time || now,
      exitTime: v.exit_time || undefined,
      model: v.model,
      customer: v.customer,
      prisma: {
        number: v.prisma_number,
        color: v.prisma_color
      },
      consultant: v.consultant,
      service: v.service,
      washStatus: v.wash_status,
      deliveryStatus: v.delivery_status || 'Aguardando Liberação',
      slotIndex: v.slot_index,
      yardId: v.yard_id,
      estimatedCompletionTime: v.estimated_completion_time,
      estimationReasoning: v.estimation_reasoning
    };
  }
};
