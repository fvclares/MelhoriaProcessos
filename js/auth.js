const SESSION_KEY = "institution-auth-session";
const REFRESH_SKEW_MS = 60_000;

function configuration() {
  const config = window.APP_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || config.supabaseUrl.includes("SEU-PROJETO")) {
    throw new Error("Configuração ausente. Preencha js/config.js com os dados públicos do Supabase.");
  }
  return config;
}

function session() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

function save(data) {
  if (!data?.access_token || !data?.refresh_token) throw new Error("A sessão retornada pela autenticação é inválida.");
  const expiresAt = Date.now() + Math.max(1, Number(data.expires_in) || 0) * 1000;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt }));
  return data.access_token;
}

async function tokenRequest(grantType, body) {
  const { supabaseUrl, supabaseAnonKey } = configuration();
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=${grantType}`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: supabaseAnonKey }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error_description || "Não foi possível autenticar.");
  return save(data);
}

export async function signIn(email, password) {
  return tokenRequest("password", { email, password });
}

export function hasSession() {
  return Boolean(session()?.refreshToken);
}

export async function accessToken() {
  const current = session();
  if (!current?.refreshToken) throw new Error("Sua sessão expirou. Entre novamente.");
  if (current.accessToken && Number(current.expiresAt) > Date.now() + REFRESH_SKEW_MS) return current.accessToken;
  try { return await tokenRequest("refresh_token", { refresh_token: current.refreshToken }); }
  catch { signOut(); throw new Error("Sua sessão expirou. Entre novamente."); }
}

export function signOut() {
  sessionStorage.removeItem(SESSION_KEY);
  // Remove as chaves usadas pelas versões anteriores para evitar reutilização de JWT expirado.
  sessionStorage.removeItem("auth-token");
  sessionStorage.removeItem("dictionary-admin-token");
}
