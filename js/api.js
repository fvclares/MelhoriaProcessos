function configuration() {
  const config = window.APP_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || config.supabaseUrl.includes("SEU-PROJETO")) {
    throw new Error("Configuração ausente. Preencha js/config.js com os dados públicos do Supabase.");
  }
  return config;
}

async function invoke(functionName, payload) {
  const { supabaseUrl, supabaseAnonKey } = configuration();
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
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

export function analyzePerception(message) { return invoke("analyze-perception", { message }); }
export function recordPerception(analysisId, classification) { return invoke("record-perception", { analysis_id: analysisId, classification }); }
