function configuration() {
  const config = window.APP_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || config.supabaseUrl.includes("SEU-PROJETO")) {
    throw new Error("Configuração ausente. Preencha js/config.js com os dados públicos do Supabase.");
  }
  return config;
}

async function invoke(functionName, payload, accessToken) {
  const { supabaseUrl, supabaseAnonKey } = configuration();
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

export function analyzePerception(message, accessToken) {
  if (!accessToken) throw new Error("Autenticação necessária. Faça login.");
  return invoke("analyze-perception", { message }, accessToken);
}
export function recordPerception(analysisId, classification, accessToken) {
  if (!accessToken) throw new Error("Autenticação necessária. Faça login.");
  return invoke("record-perception", { analysis_id: analysisId, classification }, accessToken);
}
export function dictionaryAdmin(operation, accessToken, details = {}) { return invoke("dictionary-admin", { operation, ...details }, accessToken); }
export function operationalAnalytics(accessToken) { return invoke("operational-analytics", {}, accessToken); }
export function knowledgeEvolution(operation, accessToken, details = {}) { return invoke("knowledge-evolution", { operation, ...details }, accessToken); }
export function semanticIntelligence(operation, accessToken, details = {}) { return invoke("semantic-intelligence", { operation, ...details }, accessToken); }
export function tenantContext(accessToken, details = {}) { return invoke("tenant-context", details, accessToken); }
