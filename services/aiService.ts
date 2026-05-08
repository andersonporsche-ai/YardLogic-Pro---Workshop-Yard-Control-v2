import { GoogleGenAI } from "@google/genai";
import { Vehicle, ActivityLog } from "../types";
import { differenceInHours, parseISO } from "date-fns";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const generateOptimizationSuggestions = async (allVehicles: Vehicle[], allLogs: ActivityLog[]) => {
  const model = "gemini-3.1-pro-preview";
  
  // 1. Calcular estatísticas de permanência
  const now = new Date();
  const stayTimeStats = allVehicles.map(v => {
    const entryDate = parseISO(v.entryTime);
    const hours = differenceInHours(now, entryDate);
    return {
      id: v.id,
      model: v.model,
      hours,
      washStatus: v.washStatus,
      yardId: v.yardId
    };
  });

  const avgStayTime = stayTimeStats.length > 0 
    ? stayTimeStats.reduce((acc, curr) => acc + curr.hours, 0) / stayTimeStats.length 
    : 0;

  // 2. Agrupar por status de lavagem
  const washStatusCounts = allVehicles.reduce((acc: Record<string, number>, v) => {
    acc[v.washStatus] = (acc[v.washStatus] || 0) + 1;
    return acc;
  }, {});

  // 3. Analisar fluxo (movimentações recentes)
  const recentMoves = allLogs
    .filter(log => log.action === 'status_change' || log.details.includes('movido'))
    .slice(-20)
    .map(log => ({
      time: log.timestamp,
      details: log.details,
      vehicle: log.vehiclePlate
    }));

  const yardContext = {
    statistics: {
      totalVehicles: allVehicles.length,
      averageStayHours: avgStayTime.toFixed(1),
      criticalStayCount: stayTimeStats.filter(s => s.hours > 48).length, // Mais de 2 dias
      washStatusDistribution: washStatusCounts
    },
    yards: {
      matriz: { occupancy: allVehicles.filter(v => v.yardId === 'yard').length },
      factorySubSolo: { occupancy: allVehicles.filter(v => v.yardId === 'yard2').length },
      factory1st: { occupancy: allVehicles.filter(v => v.yardId === 'yard3').length },
      factory3rd: { occupancy: allVehicles.filter(v => v.yardId === 'yard4').length },
      p1: { occupancy: allVehicles.filter(v => v.yardId === 'yardP1').length },
      p2: { occupancy: allVehicles.filter(v => v.yardId === 'yardP2').length },
      p6: { occupancy: allVehicles.filter(v => v.yardId === 'yardP6').length },
      cobertura: { occupancy: allVehicles.filter(v => v.yardId === 'yardCob').length }
    },
    recentFlow: recentMoves
  };

  const prompt = `
    Você é um consultor especialista em logística de pátios automotivos de luxo (Porsche).
    Sua missão é otimizar a alocação de veículos e reduzir gargalos operacionais.
    
    Dados Consolidados do Pátio:
    ${JSON.stringify(yardContext, null, 2)}
    
    Principais Desafios Identificados:
    1. Tempo Médio de Permanência: ${yardContext.statistics.averageStayHours} horas.
    2. Veículos parados há mais de 48h: ${yardContext.statistics.criticalStayCount}.
    3. Status de Lavagem: ${JSON.stringify(washStatusCounts)}.
    
    Diretrizes para Análise:
    - Identifique se há acúmulo de veículos aguardando lavagem e sugira realocação para pátios de pulmão (buffer) como o Subsolo ou 3º Andar.
    - Analise se o P6 (Alta Prioridade) está sendo usado eficientemente para veículos com baixa permanência.
    - Sugira estratégias para "destravar" veículos com alta permanência (>48h).
    - Recomende o fluxo ideal: Entrada -> Vistoria -> Lavagem -> Pátio de Entrega (P6/P2).
    
    Forneça um relatório estratégico em Markdown contendo:
    - **Diagnóstico do Fluxo Atual**
    - **Ações Imediatas (Low Hanging Fruits)**
    - **Sugestões de Otimização de Espaço**
    - **KPIs para Monitorar**
    
    Seja incisivo, use terminologia logística e foque em resultados práticos para uma operação Porsche.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "Não foi possível gerar sugestões no momento.";
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return "Erro ao conectar com a inteligência artificial. Verifique sua conexão.";
  }
};
