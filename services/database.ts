
import { supabase } from './supabase';
import { Vehicle, ActivityLog } from '../types';

export const databaseService = {
  // Vehicles
  async getVehicles(yardId?: string) {
    let query = supabase.from('vehicles').select('*');
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
    return data || [];
  },

  async saveLog(log: ActivityLog, yardId: string) {
    const { error } = await supabase.from('logs').insert([{ ...log, yard_id: yardId }]);
    if (error) throw error;
  },

  async updateLog(logId: string, updates: Partial<ActivityLog>) {
    const { error } = await supabase.from('logs').update(updates).eq('id', logId);
    if (error) throw error;
  },

  // Helpers
  mapVehicleToDb(v: Vehicle, yardId: string) {
    return {
      id: v.id,
      plate: v.plate,
      registration_time: v.registrationTime,
      entry_time: v.entryTime,
      status_changed_at: v.statusChangedAt,
      exit_time: v.exitTime || null,
      model: v.model,
      customer: v.customer,
      prisma_number: v.prisma.number,
      prisma_color: v.prisma.color,
      consultant: v.consultant,
      service: v.service,
      wash_status: v.washStatus,
      delivery_status: v.deliveryStatus,
      slot_index: v.slotIndex,
      yard_id: yardId
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
  }): Vehicle {
    return {
      id: v.id,
      plate: v.plate,
      registrationTime: v.registration_time,
      entryTime: v.entry_time,
      statusChangedAt: v.status_changed_at,
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
      slotIndex: v.slot_index
    };
  }
};
