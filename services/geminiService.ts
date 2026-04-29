
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Vehicle, ActivityLog } from "../types";

export const getYardInsights = async (vehicles: Vehicle[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    Como um Gestor de Operações de Pátio Porsche especializado, analise este cenário:
    
    DADOS DO PÁTIO:
    ${JSON.stringify(vehicles)}

    CONTEXTO ATUAL:
    - Ocupação: ${vehicles.length}/64 vagas.
    - Horário de Análise: ${new Date().toLocaleTimeString('pt-BR')}.

    TAREFAS:
    1. Identifique os 3 veículos que mais impactam negativamente o giro de pátio (baseado em tempo e prisma).
    2. Liste os consultores que estão operando acima da capacidade ideal (mais de 8 veículos ativos).
    3. Forneça uma estratégia tática para as próximas 2 horas para maximizar o número de vagas livres.
    
    Responda em Português do Brasil com tom executivo, direto e motivador. Use bullet points curtos.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return "Falha na análise tática. O sistema operacional central está offline.";
  }
};

export const getStrategicOptimization = async (vehicles: Vehicle[], logs: ActivityLog[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    Atue como um Especialista em Logística Industrial Porsche. Analise os dados abaixo para otimizar o layout (Setores A-M) e o fluxo de trabalho.

    VEÍCULOS ATIVOS: ${JSON.stringify(vehicles.map(v => ({ id: v.id, model: v.model, status: v.washStatus, slot: v.slotIndex })))}
    HISTÓRICO RECENTE: ${JSON.stringify(logs.slice(0, 30))}

    OBJETIVO:
    Gere 4 recomendações técnicas e acionáveis:
    1. Otimização Setorial: Sugira remanejamento entre os setores A-C (Teste/Rápido) e D-M (Oficina/Longo Prazo).
    2. Eficiência de Status: Identifique qual status (Lavagem, Mecânica, Peças) está retendo mais veículos.
    3. Planejamento de Equipe: Preveja necessidade de pessoal baseado no fluxo de entrada.
    4. Priorização por Prisma: Como usar as cores atuais para sinalizar prioridades de saída.

    FORMATO:
    Retorne 4 parágrafos objetivos. Use emojis. Português do Brasil. Tom de alta gerência.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Strategic Optimization Error:", error);
    return "Não foi possível gerar recomendações estratégicas no momento. Verifique sua chave de API.";
  }
};

export const getLayoutAndFlowOptimization = async (vehicles: Vehicle[], logs: ActivityLog[], maxSlots: number) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    Como um Engenheiro de Processos e Logística Porsche de elite, sua missão é otimizar o layout físico e o fluxo operacional do pátio.

    DADOS ATUAIS DO PÁTIO:
    - Capacidade Total: ${maxSlots} vagas.
    - Veículos Ativos: ${JSON.stringify(vehicles.map(v => ({ 
      plate: v.plate, 
      model: v.model, 
      slot: v.slotIndex, 
      status: v.washStatus,
      entry: v.entryTime,
      service: v.serviceType
    })))}

    HISTÓRICO DE MOVIMENTAÇÃO (FREQUÊNCIA E FLUXO):
    ${JSON.stringify(logs.slice(0, 100))}

    DIRETRIZES DE ANÁLISE:
    1. Distribuição de Vagas: Analise como os veículos estão espalhados (0 a ${maxSlots - 1}).
    2. Tempo Médio de Permanência: Calcule o impacto dos veículos que estão há mais tempo baseando-se na data de entrada.
    3. Frequência por Setor: Identifique quais áreas do pátio têm mais movimentação e sugira uma setorização lógica.

    PROPOSTA DE OTIMIZAÇÃO (GERAR 4 SEÇÕES):
    1. Ajustes de Layout: Proponha uma nova configuração de setores baseada no tipo de serviço (ex: Mecânica vs. Estética) para minimizar deslocamentos.
    2. Fluxo de Entrada e Saída: Sugira como organizar as vagas próximas aos portões para acelerar o turnover e melhorar o fluxo.
    3. Alocação por Serviço: Como agrupar veículos por tipo de serviço para facilitar o acesso das equipes técnicas.
    4. Redução de Riscos: Identifique pontos críticos e proponha mudanças para reduzir riscos de colisão e aumentar a segurança.

    Responda em Português do Brasil. Use um tom altamente técnico, preciso e focado em segurança e eficiência Porsche.
    Retorne a resposta formatada com títulos em negrito e listas de ações claras.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Layout Optimization Error:", error);
    return "Falha ao gerar análise de layout e fluxo. Tente novamente mais tarde.";
  }
};

export const getSafetyAnalysis = async (vehicles: Vehicle[], layout: { row: string; label: string; slots: number }[], yardName: string, logs: ActivityLog[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    Como um Especialista em Segurança do Trabalho e Logística Porsche de classe mundial, analise o layout atual do pátio "${yardName}" e identifique riscos críticos de colisão.

    DADOS DO PÁTIO:
    - Layout Físico: ${JSON.stringify(layout.map(s => ({ row: s.row, label: s.label, slots: s.slots })))}
    - Veículos Ativos: ${JSON.stringify(vehicles.map(v => ({ 
      plate: v.plate, 
      model: v.model, 
      slot: v.slotIndex, 
      status: v.washStatus,
      service: v.serviceType
    })))}
    - Histórico de Movimentação Recente (Fluxo): ${JSON.stringify(logs.slice(0, 50).map(l => ({ action: l.action, plate: l.vehiclePlate, time: l.timestamp })))}

    SUA MISSÃO:
    1. **Identificação de Pontos Críticos**: Localize áreas onde a densidade de veículos ou o cruzamento de fluxos (entrada/saída/lavagem) cria gargalos perigosos.
    2. **Riscos de Colisão Iminentes**: Analise se veículos em determinadas vagas (ex: cantos, corredores estreitos) estão obstruindo manobras de outros modelos Porsche.
    3. **Sugestão de Rotas Seguras**: Proponha um fluxo unidirecional ou rotas específicas para minimizar o risco de colisões durante a movimentação para lavagem ou oficina.
    4. **Protocolo de Prevenção**: Liste 3 ações imediatas para o pátio hoje.

    RESPOSTA OBRIGATÓRIA EM JSON:
    Retorne um objeto JSON com a seguinte estrutura:
    {
      "insights": "Texto formatado em Markdown com a análise detalhada, títulos e listas.",
      "riskySlots": [1, 5, 12], // Lista de índices das vagas (0 a n) que apresentam maior risco de colisão ou obstrução
      "safetyScore": 85, // Pontuação de 0 a 100 para a segurança atual do pátio
      "criticalPoints": [
        { "area": "Entrada Principal", "risk": "Alta densidade de manobras", "recommendation": "Aguardar liberação do corredor A antes de entrar" }
      ],
      "safeRoutes": [
        { "from": "Vagas A1-A10", "to": "Lavagem", "route": "Seguir pelo corredor central, evitar retorno pela rampa sul" }
      ]
    }

    Responda APENAS o JSON, sem blocos de código ou explicações extras. Português do Brasil.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    try {
      return JSON.parse(response.text);
    } catch {
      // Fallback if JSON parsing fails
      return {
        insights: response.text,
        riskySlots: [],
        safetyScore: 0,
        criticalPoints: [],
        safeRoutes: []
      };
    }
  } catch (error) {
    console.error("Safety Analysis Error:", error);
    return {
      insights: "Não foi possível realizar a análise de segurança no momento. O protocolo de contingência deve ser seguido.",
      riskySlots: [],
      safetyScore: 0,
      criticalPoints: [],
      safeRoutes: []
    };
  }
};
export const extractLicensePlate = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
          { text: `
            Você é um especialista em OCR de alta precisão para logística automotiva global.
            Analise a imagem do veículo e extraia a PLACA (License Plate).
            
            FORMATOS PRIORITÁRIOS (BRASIL/MERCOSUL):
            1. Mercosul Brasil: ABC1D23 (3 letras, 1 número, 1 letra, 2 números)
            2. Mercosul Argentina: AB123CD (2 letras, 3 números, 2 letras)
            3. Brasileiro Antigo: ABC-1234 (3 letras, 4 números)
            4. Outros Mercosul (Uruguai, Paraguai): Ex: ABC 1234, ABC 123
            
            DIRETRIZES DE EXTRAÇÃO:
            - Extraia a sequência alfanumérica da placa.
            - Para placas o Padrão Brasileiro Antigo (ABC-1234), MANTENHA o hífen para distinção.
            - Para placas Mercosul, retorne apenas os 7 caracteres alfanuméricos.
            - MUITO IMPORTANTE: No padrão Mercosul Brasil (ABC1D23), o 5º caractere é SEMPRE uma letra.
            - No padrão Brasileiro Antigo (ABC-1234), os últimos 4 caracteres são SEMPRE números.
            - Se a placa tiver uma tarja azul no topo com "BRASIL" ou "MERCOSUL", ignore esses nomes.
            - Remova espaços e pontos.
            - Retorne exatamente NOT_FOUND se nada for visível.
          ` }
        ]
      },
      config: {
        temperature: 0,
      }
    });

    const result = response.text?.trim().toUpperCase();
    // Allow alphanumeric and hyphens, remove everything else
    const cleanPlate = result?.replace(/[^A-Z0-9-]/g, '');
    
    // Some international plates can be short, so we lower the minimum length requirement
    if (cleanPlate && cleanPlate !== 'NOT_FOUND' && cleanPlate.length >= 4) {
      return cleanPlate;
    }
    return null;
  } catch (error) {
    console.error("OCR Error:", error);
    return null;
  }
};
