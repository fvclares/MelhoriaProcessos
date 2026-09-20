import { accessToken as currentAccessToken } from "./auth.js";

function configuration() {
  const config = window.APP_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || config.supabaseUrl.includes("SEU-PROJETO")) {
    throw new Error("Configuração ausente. Preencha js/config.js com os dados públicos do Supabase.");
  }
  return config;
}

async function invoke(functionName, payload) {
  const { supabaseUrl, supabaseAnonKey } = configuration();
  const accessToken = await currentAccessToken();
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message || "Não foi possível concluir o teste.");
  }
  return body;
}

export function analyzeConversation(messages) {
  return invoke("analyze-perception", { messages });
}
export function recordPerception(analysisId, classification) {
  return invoke("record-perception", { analysis_id: analysisId, classification });
}
export function dictionaryAdmin(operation, details = {}) { return invoke("dictionary-admin", { operation, ...details }); }
export function operationalAnalytics() { return invoke("operational-analytics", {}); }
export function knowledgeEvolution(operation, details = {}) { return invoke("knowledge-evolution", { operation, ...details }); }
export function semanticIntelligence(operation, details = {}) { return invoke("semantic-intelligence", { operation, ...details }); }
