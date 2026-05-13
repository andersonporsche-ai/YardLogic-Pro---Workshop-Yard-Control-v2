
import emailjs from '@emailjs/browser';
import { Vehicle } from '../types';
import { CONSULTANT_EMAILS } from '../constants';

// Configuration - Usually these would be in environment variables
// VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_yardlogic';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_ready_vehicle';
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'public_key_placeholder';

export const sendReadyNotification = async (vehicle: Vehicle, yardName: string) => {
  const consultantEmail = CONSULTANT_EMAILS[vehicle.consultant];
  
  if (!consultantEmail) {
    console.warn(`No email found for consultant: ${vehicle.consultant}`);
    return;
  }

  const templateParams = {
    to_name: vehicle.consultant,
    to_email: consultantEmail,
    vehicle_model: vehicle.model,
    vehicle_plate: vehicle.plate,
    yard_name: yardName,
    slot_index: vehicle.slotIndex + 1,
    ready_time: new Date().toLocaleString('pt-BR'),
    customer_name: vehicle.customer,
    service_type: vehicle.service
  };

  try {
    // Note: This will only work if the user has configured EmailJS
    // In this preview environment, we just log the attempt if keys are missing
    if (PUBLIC_KEY === 'public_key_placeholder') {
      console.log('--- SIMULAÇÃO DE E-MAIL ENVIADO ---');
      console.log(`Para: ${vehicle.consultant} <${consultantEmail}>`);
      console.log(`Assunto: Veículo Pronto para Entrega - ${vehicle.plate}`);
      console.log(`Mensagem: O veículo ${vehicle.model} (${vehicle.plate}) na vaga ${vehicle.slotIndex + 1} (${yardName}) está pronto.`);
      console.log('------------------------------------');
      return { status: 200, text: 'Simulated OK' };
    }

    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );

    console.log('Email sent successfully:', response.status, response.text);
    return response;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    throw error;
  }
};
