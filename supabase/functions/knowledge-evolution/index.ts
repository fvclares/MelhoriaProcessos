import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROMPT_VERSION = "mvp5.0.0";
const corsHeaders = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json; charset=utf-8" };
function origin(value: string | null) { return value?.trim().replace(/\/$/, "") ?? null; }
function reply(status: number, body: unknown, requestOrigin: string | null) { const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null); return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed && allowed === origin(requestOrigin) ? allowed : (allowed ?? "") } }); }
function isId(value: unknown, valid: Set<string>) { return typeof value === "string" && valid.has(value); }

Deno.serve(async (request) => {
  const requestOrigin = origin(request.headers.get("Origin")); const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  if (request.method === "OPTIONS") return allowed && requestOrigin === allowed ? new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed } }) : reply(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (!allowed || requestOrigin !== allowed) return reply(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (request.method !== "POST") return reply(405, { error: { message: "Use POST." } }, requestOrigin);

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, ""); const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !anonKey || !serviceKey) return reply(401, { error: { message: "Autenticação administrativa necessária." } }, requestOrigin);
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await serviceClient.auth.getUser(token); const admins = (Deno.env.get("ADMIN_USER_IDS") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (userError || !userData.user || !admins.includes(userData.user.id)) return reply(403, { error: { message: "Este usuário não possui acesso administrativo." } }, requestOrigin);
  const { data: membership } = await serviceClient.from("company_members").select("company_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
  if (!membership?.company_id) return reply(403, { error: { message: "Usuário sem empresa associada." } }, requestOrigin);
  const companyId = membership.company_id;
  const client = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: rlsCheck } = await client.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (!rlsCheck) return reply(403, { error: { message: "Usuário sem empresa associada." } }, requestOrigin);

  try {
    const payload = await request.json();
    if (payload?.operation === "list") {
      const { data, error } = await client.from("knowledge_suggestions").select("id, suggestion_type, proposal, evidence, status, created_at, reviewed_at, review_note").order("created_at", { ascending: false }).limit(100);
      if (error) throw error; return reply(200, { suggestions: data }, requestOrigin);
    }
    if (payload?.operation === "review") {
      if (typeof payload.suggestion_id !== "string" || typeof payload.approved !== "boolean") return reply(400, { error: { message: "Decisão inválida." } }, requestOrigin);
      const { error } = await client.rpc("review_knowledge_suggestion", { p_suggestion_id: payload.suggestion_id, p_approved: payload.approved, p_actor_id: userData.user.id, p_note: typeof payload.note === "string" ? payload.note.slice(0, 500) : null });
      if (error) return reply(409, { error: { message: "A sugestão não pôde ser aplicada ou já foi revisada." } }, requestOrigin);
      return reply(200, { status: payload.approved ? "approved" : "rejected" }, requestOrigin);
    }
    if (payload?.operation !== "generate") return reply(400, { error: { message: "Operação não reconhecida." } }, requestOrigin);

    const [{ data: entities, error: entitiesError }, { data: recurrences, error: recurrenceError }] = await Promise.all([
      client.from("dictionary_entity_summary").select("id, entity_type, canonical_name, governance_status, evidence_count").neq("governance_status", "consolidated").order("evidence_count", { ascending: false }).limit(100),
      client.from("recurrence_summary").select("sistema, processo, subprocesso, categoria_problema, occurrences").gt("occurrences", 1).order("occurrences", { ascending: false }).limit(30),
    ]);
    if (entitiesError || recurrenceError) throw entitiesError ?? recurrenceError;
    const validIds = new Set((entities ?? []).map((entity) => entity.id)); const byId = new Map((entities ?? []).map((entity) => [entity.id, entity]));
    const apiKey = Deno.env.get("GEMINI_API_KEY"); const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
    if (!apiKey) throw new Error("gemini_not_configured");
    const prompt = `Você é um assessor de governança de conhecimento operacional. Gere no máximo 12 SUGESTÕES, nunca decisões. Use somente os IDs e dados fornecidos. Tipos: discover (homologar candidato recorrente), group (consolidar sinônimos prováveis do mesmo tipo), relate (relacionar entidades existentes) e refine (sugerir subcategoria para uma categoria atual). Responda somente JSON: {"suggestions":[{"type":"discover|group|relate|refine", "entity_id":"...", "source_entity_id":"...", "target_entity_id":"...", "evidence_count":0, "parent_category":"...", "proposed_category":"...", "rationale":"...", "evidence":["..."]}]}. Em cada item, preencha apenas os campos relevantes. Não invente IDs.\nENTIDADES: ${JSON.stringify(entities)}\nRECORRÊNCIAS: ${JSON.stringify(recurrences)}`;
    const provider = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }) });
    if (!provider.ok) throw new Error(`gemini_${provider.status}`);
    const rawResponse = await provider.json(); let parsed: unknown; try { parsed = JSON.parse(rawResponse?.candidates?.[0]?.content?.parts?.[0]?.text); } catch { parsed = null; }
    const suggestions = Array.isArray((parsed as { suggestions?: unknown })?.suggestions) ? (parsed as { suggestions: unknown[] }).suggestions : [];
    const accepted = [] as { suggestion_type: string; proposal: Record<string, unknown>; fingerprint: string; evidence: unknown[]; raw_response: unknown; prompt_version: string; company_id: string }[];
    const add = (suggestion_type: string, proposal: Record<string, unknown>, evidence: unknown[]) => accepted.push({ suggestion_type, proposal, fingerprint: JSON.stringify({ suggestion_type, proposal, company_id: companyId }), evidence, raw_response: rawResponse, prompt_version: PROMPT_VERSION, company_id: companyId });
    for (const item of suggestions.slice(0, 12)) {
      if (!item || typeof item !== "object") continue; const s = item as Record<string, unknown>; const type = s.type; const rationale = typeof s.rationale === "string" ? s.rationale.slice(0, 500) : ""; const evidence = Array.isArray(s.evidence) ? s.evidence.filter((value) => typeof value === "string").slice(0, 10) : [];
      if (type === "discover" && isId(s.entity_id, validIds) && byId.get(s.entity_id)?.governance_status === "candidate") add(type, { entity_id: s.entity_id, rationale }, evidence);
      if (type === "group" && isId(s.source_entity_id, validIds) && isId(s.target_entity_id, validIds) && s.source_entity_id !== s.target_entity_id && byId.get(s.source_entity_id)?.entity_type === byId.get(s.target_entity_id)?.entity_type) add(type, { source_entity_id: s.source_entity_id, target_entity_id: s.target_entity_id, rationale }, evidence);
      if (type === "relate" && isId(s.source_entity_id, validIds) && isId(s.target_entity_id, validIds) && s.source_entity_id !== s.target_entity_id) add(type, { source_entity_id: s.source_entity_id, target_entity_id: s.target_entity_id, evidence_count: Math.max(0, Number(s.evidence_count) || 0), rationale }, evidence);
      if (type === "refine" && typeof s.parent_category === "string" && typeof s.proposed_category === "string" && s.parent_category.length <= 80 && s.proposed_category.length <= 80) add(type, { parent_category: s.parent_category, proposed_category: s.proposed_category, rationale }, evidence);
    }
    if (accepted.length) { const { error } = await client.from("knowledge_suggestions").upsert(accepted, { onConflict: "fingerprint", ignoreDuplicates: true }); if (error) throw error; }
    return reply(200, { created: accepted.length, ignored: suggestions.length - accepted.length }, requestOrigin);
  } catch (error) {
    console.error("Knowledge evolution failed", error instanceof Error ? error.message : "unexpected_error");
    return reply(500, { error: { message: "Não foi possível processar sugestões de evolução." } }, requestOrigin);
  }
});
