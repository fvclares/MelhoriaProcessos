import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROMPT_VERSION = "mvp1.0.0";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
const TYPES = ["reclamacao", "sugestao", "duvida", "elogio", "outro"] as const;
const CATEGORIES = ["erro", "lentidao", "acesso", "usabilidade", "integracao", "processo", "informacao", "outro"] as const;
const EVIDENCE = ["observed", "inferred", "suggested"] as const;
const FIELD_NAMES = ["tipo", "processo", "subprocesso", "sistema", "categoria_problema"] as const;
const corsHeaders = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json; charset=utf-8" };

type FieldValue = { value: string | null; evidence: string; confidence: number };
type Interpretation = { single_issue: boolean; interpretation: string; fields: Record<(typeof FIELD_NAMES)[number], FieldValue>; context: string[]; entity_candidates: { name: string; suggested_type: string; evidence: string; confidence: number }[]; clarification_required: boolean; clarification_question: string | null; confirmation_required: boolean };

const fieldSchema = { type: "object", properties: { value: { type: "string", nullable: true }, evidence: { type: "string", enum: ["observed", "inferred", "suggested"] }, confidence: { type: "number", minimum: 0, maximum: 1 } }, required: ["value", "evidence", "confidence"] };
const responseSchema = {
  type: "object",
  properties: {
    single_issue: { type: "boolean" }, interpretation: { type: "string" },
    fields: { type: "object", properties: Object.fromEntries(FIELD_NAMES.map((name) => [name, fieldSchema])), required: FIELD_NAMES },
    context: { type: "array", items: { type: "string" }, maxItems: 10 },
    entity_candidates: { type: "array", items: { type: "object", properties: { name: { type: "string" }, suggested_type: { type: "string", enum: ["processo", "subprocesso", "sistema"] }, evidence: { type: "string", enum: EVIDENCE }, confidence: { type: "number", minimum: 0, maximum: 1 } }, required: ["name", "suggested_type", "evidence", "confidence"] } },
    clarification_required: { type: "boolean" }, clarification_question: { type: "string", nullable: true }, confirmation_required: { type: "boolean" },
  },
  required: ["single_issue", "interpretation", "fields", "context", "entity_candidates", "clarification_required", "clarification_question", "confirmation_required"],
} as const;

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  return value.trim().replace(/\/$/, "");
}

function json(status: number, body: unknown, origin: string | null) {
  const allowedOrigin = normalizeOrigin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  const requestOrigin = normalizeOrigin(origin);
  const accessOrigin = allowedOrigin && requestOrigin === allowedOrigin ? allowedOrigin : (allowedOrigin ?? "");
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Access-Control-Allow-Origin": accessOrigin } });
}
function validField(value: unknown): value is FieldValue {
  if (!value || typeof value !== "object") return false;
  const field = value as Record<string, unknown>;
  return (typeof field.value === "string" || field.value === null) && typeof field.evidence === "string" && EVIDENCE.includes(field.evidence as typeof EVIDENCE[number]) && typeof field.confidence === "number" && Number.isFinite(field.confidence) && field.confidence >= 0 && field.confidence <= 1;
}
function isInterpretation(value: unknown): value is Interpretation {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (typeof data.single_issue !== "boolean" || typeof data.interpretation !== "string" || !data.interpretation.trim() || !data.fields || typeof data.fields !== "object" || !Array.isArray(data.context) || !Array.isArray(data.entity_candidates) || typeof data.clarification_required !== "boolean" || typeof data.confirmation_required !== "boolean" || !(typeof data.clarification_question === "string" || data.clarification_question === null)) return false;
  const fields = data.fields as Record<string, unknown>;
  if (!FIELD_NAMES.every((name) => validField(fields[name]))) return false;
  if (!data.context.every((item) => typeof item === "string") || !data.entity_candidates.every((item) => {
    const candidate = item as Record<string, unknown>;
    return candidate && typeof candidate.name === "string" && ["processo", "subprocesso", "sistema"].includes(candidate.suggested_type as string) && EVIDENCE.includes(candidate.evidence as typeof EVIDENCE[number]) && typeof candidate.confidence === "number" && candidate.confidence >= 0 && candidate.confidence <= 1;
  })) return false;
  if ((fields.tipo.value !== null && !TYPES.includes(fields.tipo.value as typeof TYPES[number])) || (fields.categoria_problema.value !== null && !CATEGORIES.includes(fields.categoria_problema.value as typeof CATEGORIES[number]))) return false;
  const clarificationQuestion = typeof data.clarification_question === "string" ? data.clarification_question : null;
  if ((!data.single_issue || data.clarification_required) && !clarificationQuestion?.trim()) return false;
  return data.confirmation_required === true;
}
async function audit(outcome: string, responseValid: boolean, latencyMs: number, errorCode?: string) {
  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) return;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.from("mvp0_call_audits").insert({ model: MODEL, latency_ms: latencyMs, outcome, response_valid: responseValid, error_code: errorCode ?? null });
  if (error) console.error("MVP audit failed", error.code);
}
async function resolveCompanyId(token: string): Promise<{ companyId: string; userClient: ReturnType<typeof createClient> }> {
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) throw new Error("persistence_not_configured");
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error("auth_required");
  const userClient = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  // também valida via service para obter company (bypass RLS se necessario)
  const { data: membership, error: memberError } = await serviceClient.from("company_members").select("company_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (memberError || !membership?.company_id) throw new Error("company_not_found");
  // verifica que o JWT realmente tem acesso via RLS (defesa em profundidade)
  const { data: rlsCheck } = await userClient.from("companies").select("id").eq("id", membership.company_id).maybeSingle();
  if (!rlsCheck) throw new Error("company_not_found");
  return { companyId: membership.company_id, userClient };
}
async function createAnalysisSession(message: string, rawResponse: unknown, interpretation: Interpretation, token: string, companyId: string) {
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("persistence_not_configured");
  const userClient = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await userClient.from("analysis_sessions").insert({
    original_text: message, prompt_version: PROMPT_VERSION, model: MODEL, raw_response: rawResponse, proposed_interpretation: interpretation, company_id: companyId,
  }).select("id").single();
  if (error || !data?.id) throw new Error("analysis_session_failed");
  return data.id as string;
}
function promptFor(message: string) {
  return `Você interpreta UMA percepção operacional em português brasileiro. Não invente fatos. Se um campo não for determinável, use valor null, evidence "suggested" e faça uma pergunta de esclarecimento. Se houver mais de um problema principal, single_issue deve ser false e a pergunta deve pedir qual registrar primeiro.\n\nTipos permitidos: reclamacao, sugestao, duvida, elogio, outro. Categorias permitidas: erro, lentidao, acesso, usabilidade, integracao, processo, informacao, outro.\n\nPara processo, subprocesso e sistema, extraia apenas termos presentes ou claramente inferíveis. Eles não são entidades homologadas. Use entity_candidates somente para termos novos ou não confirmados; nunca afirme que foram homologados. Contexto contém detalhes úteis que não viram entidades. confidence é um sinal heurístico, não uma probabilidade. confirmation_required deve ser sempre true.\n\nVersão do contrato: ${PROMPT_VERSION}.\nRelato: ${JSON.stringify(message)}`;
}

Deno.serve(async (request) => {
  const origin = normalizeOrigin(request.headers.get("Origin")); const allowedOrigin = normalizeOrigin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  if (request.method === "OPTIONS") {
    if (allowedOrigin && origin === allowedOrigin) return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowedOrigin } });
    return json(403, { error: { code: "origin_not_allowed", message: "Origem não autorizada." } }, origin);
  }
  if (!allowedOrigin || origin !== allowedOrigin) return json(403, { error: { code: "origin_not_allowed", message: "Origem não autorizada." } }, origin);
  if (request.method !== "POST") return json(405, { error: { code: "method_not_allowed", message: "Use POST." } }, origin);
  const startedAt = Date.now();
  // MVP7: exige autenticacao e resolve empresa via company_members
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: { code: "auth_required", message: "Autenticação necessária." } }, origin);
  let companyId: string; let userToken = token;
  try {
    const resolved = await resolveCompanyId(token);
    companyId = resolved.companyId;
    userToken = token;
  } catch {
    return json(403, { error: { code: "company_not_found", message: "Usuário sem empresa associada." } }, origin);
  }
  try {
    const payload = await request.json(); const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (!message || message.length > 2000) { await audit("request_error", false, Date.now() - startedAt, "invalid_message"); return json(400, { error: { code: "invalid_message", message: "Envie uma mensagem entre 1 e 2000 caracteres." } }, origin); }
    const apiKey = Deno.env.get("GEMINI_API_KEY"); if (!apiKey) throw new Error("gemini_not_configured");
    const provider = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: promptFor(message) }] }], generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0 } }) });
    if (!provider.ok) {
      const errText = await provider.text().catch(() => "");
      let detail = errText;
      try {
        const parsedErr = JSON.parse(errText);
        detail = parsedErr?.error?.message ?? parsedErr?.error?.status ?? errText;
      } catch { /* mantém texto bruto */ }
      const safeDetail = String(detail).replace(/key=[^&\s]*/gi, "key=***").slice(0, 100);
      console.error("Gemini upstream error", provider.status, safeDetail);
      throw new Error(`gemini_${provider.status} ${safeDetail}`.slice(0, 100));
    }
    const providerBody = await provider.json(); const rawText = providerBody?.candidates?.[0]?.content?.parts?.[0]?.text;
    let parsed: unknown; try { parsed = JSON.parse(rawText); } catch { parsed = null; }
    if (!isInterpretation(parsed)) { await audit("invalid_ai_response", false, Date.now() - startedAt, "invalid_provider_json"); return json(502, { error: { code: "invalid_provider_response", message: "A IA não retornou o contrato de interpretação esperado." } }, origin); }
    const analysis_id = await createAnalysisSession(message, providerBody, parsed, userToken, companyId);
    const latencyMs = Date.now() - startedAt; await audit("success", true, latencyMs);
    return json(200, { analysis_id, contract_version: PROMPT_VERSION, model: MODEL, latency_ms: latencyMs, ...parsed }, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : "unexpected_error"; await audit("provider_error", false, Date.now() - startedAt, code.slice(0, 100)); console.error("MVP1 request failed", code);
    return json(502, { error: { code: "upstream_failure", message: "Falha temporária na conexão com a IA." } }, origin);
  }
});
