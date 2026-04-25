import { GoogleGenAI } from "@google/genai";
import { YARD_LAYOUT, YARD_LAYOUT_FACTORY, YARD_LAYOUT_1ST_FLOOR, YARD_LAYOUT_1ST_FACTORY, YARD_LAYOUT_P1, YARD_LAYOUT_P2, YARD_LAYOUT_P6, YARD_LAYOUT_COBERTURA } from "../constants";
import { Vehicle } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const generateOptimizationSuggestions = async (allVehicles: Vehicle[]) => {
  const model = "gemini-3.1-pro-preview";
  
  const yardContext = {
    matriz: { layout: YARD_LAYOUT, occupancy: allVehicles.filter(v => v.slotIndex < 100).length }, // Rough estimation based on slot ranges if not explicitly tagged
    factorySubSolo: { layout: YARD_LAYOUT_FACTORY },
    factory1st: { layout: YARD_LAYOUT_1ST_FLOOR },
    factory3rd: { layout: YARD_LAYOUT_1ST_FACTORY },
    p1: { layout: YARD_LAYOUT_P1 },
    p2: { layout: YARD_LAYOUT_P2 },
    p6: { layout: YARD_LAYOUT_P6 },
    cobertura: { layout: YARD_LAYOUT_COBERTURA }
  };

  const prompt = `
    Você é um consultor especialista em logística de pátios automotivos de luxo (Porsche).
    Analise a estrutura atual dos pátios e sugira otimizações estratégicas.
    
    Contexto dos Pátios:
    ${JSON.stringify(yardContext, null, 2)}
    
    Veículos Atuais no Pátio: ${allVehicles.length}
    
    Considere:
    1. Fluxo de trabalho (Workshop -> Lavagem -> Entrega).
    2. Alocação de vagas por tipo de serviço (PDI, Revisão, Blindagem, etc).
    3. Redução de gargalos e tempo de movimentação.
    4. Priorização de vagas (ex: P6 é alta prioridade).
    
    Forneça 3 a 5 sugestões concretas e acionáveis em formato Markdown. 
    Seja profissional, técnico e focado em eficiência operacional.
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
