const FUNCTION_NAME = "analyze-perception";

function configuration() {
  const config = window.APP_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || config.supabaseUrl.includes("SEU-PROJETO")) {
    throw new Error("Configuração ausente. Crie js/config.js a partir de js/config.example.js.");
  }
  return config;
}

export async function analyzePerception(message) {
  const { supabaseUrl, supabaseAnonKey } = configuration();
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/${FUNCTION_NAME}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ message }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message || "Não foi possível concluir o teste.");
  }
  return body;
}
