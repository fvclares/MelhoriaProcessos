import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TYPES = ["reclamacao", "sugestao", "duvida", "elogio", "outro"];
const CATEGORIES = ["erro", "lentidao", "acesso", "usabilidade", "integracao", "processo", "informacao", "outro"];
const FIELDS = ["tipo", "processo", "subprocesso", "sistema", "categoria_problema"];
const corsHeaders = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json; charset=utf-8" };

type Classification = { tipo: string; processo: string | null; subprocesso: string | null; sistema: string | null; categoria_problema: string };

function normalizeOrigin(value: string | null) { return value?.trim().replace(/\/$/, "") ?? null; }
function reply(status: number, body: unknown, origin: string | null) {
  const allowed = normalizeOrigin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  const requestOrigin = normalizeOrigin(origin);
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed && allowed === requestOrigin ? allowed : (allowed ?? "") } });
}
function cleanText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, 160) : null;
}
function validClassification(value: unknown): value is Classification {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (!FIELDS.every((field) => field in data)) return false;
  const processo = cleanText(data.processo); const subprocesso = cleanText(data.subprocesso); const sistema = cleanText(data.sistema);
  return typeof data.tipo === "string" && TYPES.includes(data.tipo) && typeof data.categoria_problema === "string" && CATEGORIES.includes(data.categoria_problema) && processo !== undefined && subprocesso !== undefined && sistema !== undefined;
}

Deno.serve(async (request) => {
  const origin = normalizeOrigin(request.headers.get("Origin")); const allowed = normalizeOrigin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  if (request.method === "OPTIONS") {
    if (allowed && origin === allowed) return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed } });
    return reply(403, { error: { code: "origin_not_allowed", message: "Origem não autorizada." } }, origin);
  }
  if (!allowed || origin !== allowed) return reply(403, { error: { code: "origin_not_allowed", message: "Origem não autorizada." } }, origin);
  if (request.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } }, origin);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: { code: "auth_required", message: "Autenticação necessária." } }, origin);
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(500, { error: { code: "persistence_failed", message: "Não foi possível registrar a percepção." } }, origin);
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !userData.user) return reply(401, { error: { code: "auth_required", message: "Autenticação necessária." } }, origin);
  const { data: membership } = await serviceClient.from("user_roles").select("user_id").eq("user_id", userData.user.id).maybeSingle();
  if (!membership) return reply(403, { error: { code: "institution_access_required", message: "Usuário sem acesso à instituição." } }, origin);
  const userClient = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  try {
    const payload = await request.json();
    if (typeof payload?.analysis_id !== "string" || !validClassification(payload?.classification)) {
      return reply(400, { error: { code: "invalid_confirmation", message: "Revise os campos obrigatórios antes de confirmar." } }, origin);
    }
    const classification = payload.classification as Record<string, unknown>;
    const canonical = {
      tipo: classification.tipo,
      processo: cleanText(classification.processo),
      subprocesso: cleanText(classification.subprocesso),
      sistema: cleanText(classification.sistema),
      categoria_problema: classification.categoria_problema,
    };
    const { data, error } = await serviceClient.rpc("persist_validated_perception", { p_session_id: payload.analysis_id, p_classification: canonical, p_actor_id: userData.user.id });
    if (error) {
      const code = error.message.includes("analysis_session_unavailable") ? "analysis_session_unavailable" : "persistence_failed";
      return reply(code === "analysis_session_unavailable" ? 409 : 500, { error: { code, message: code === "analysis_session_unavailable" ? "Esta análise expirou ou já foi confirmada. Faça uma nova interpretação." : "Não foi possível registrar a percepção." } }, origin);
    }
    return reply(201, { perception_id: data, status: "validated" }, origin);
  } catch (error) {
    console.error("MVP2 record failed", error instanceof Error ? error.message : "unexpected_error");
    return reply(500, { error: { code: "persistence_failed", message: "Não foi possível registrar a percepção." } }, origin);
  }
});
