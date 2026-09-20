import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json; charset=utf-8" };
const TYPES = ["processo", "subprocesso", "sistema"];

function origin(value: string | null) { return value?.trim().replace(/\/$/, "") ?? null; }
function response(status: number, body: unknown, requestOrigin: string | null) {
  const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed && allowed === origin(requestOrigin) ? allowed : (allowed ?? "") } });
}
function normalized(value: string) { return value.trim().replace(/\s+/g, " ").toLowerCase(); }
function text(value: unknown) { return typeof value === "string" && value.trim() && value.trim().length <= 160 ? value.trim() : null; }

Deno.serve(async (request) => {
  const requestOrigin = origin(request.headers.get("Origin")); const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  if (request.method === "OPTIONS") return allowed && requestOrigin === allowed ? new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed } }) : response(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (!allowed || requestOrigin !== allowed) return response(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (request.method !== "POST") return response(405, { error: { message: "Use POST." } }, requestOrigin);

  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!bearer || !url || !anonKey || !serviceKey) return response(401, { error: { message: "Autenticação administrativa necessária." } }, requestOrigin);
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await serviceClient.auth.getUser(bearer);
  if (userError || !userData.user) return response(403, { error: { message: "Este usuário não possui acesso administrativo." } }, requestOrigin);
  const { data: adminCheck } = await serviceClient.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
  if (!adminCheck || adminCheck.role !== "admin") return response(403, { error: { message: "Este usuário não possui acesso administrativo." } }, requestOrigin);
  const client = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${bearer}` } } });

  try {
    const payload = await request.json(); const operation = payload?.operation;
    if (operation === "list") {
      const { data, error } = await client.from("dictionary_entity_summary").select("*").order("governance_status").order("evidence_count", { ascending: false });
      if (error) throw error;
      return response(200, { entities: data }, requestOrigin);
    }

    const entityId = typeof payload?.entity_id === "string" ? payload.entity_id : null;
    if (!entityId) return response(400, { error: { message: "Entidade inválida." } }, requestOrigin);
    const { data: entity, error: entityError } = await client.from("entities").select("id, entity_type, canonical_name, governance_status").eq("id", entityId).single();
    if (entityError || !entity) return response(404, { error: { message: "Entidade não encontrada." } }, requestOrigin);

    if (operation === "detail") {
      const [{ data: aliases, error: aliasError }, { data: evidence, error: evidenceError }] = await Promise.all([
        client.from("entity_aliases").select("alias, created_at").eq("entity_id", entityId).order("alias"),
        client.from("entity_evidence").select("extracted_value, evidence_state, created_at, perceptions(original_text, created_at)").eq("entity_id", entityId).order("created_at", { ascending: false }).limit(20),
      ]);
      if (aliasError || evidenceError) throw (aliasError ?? evidenceError);
      return response(200, { entity, aliases, evidence }, requestOrigin);
    }

    if (operation === "homologate" || operation === "reject") {
      const next = operation === "homologate" ? "homologated" : "rejected";
      const stamp = operation === "homologate" ? { governance_status: next, homologated_at: new Date().toISOString(), rejected_at: null, updated_at: new Date().toISOString() } : { governance_status: next, rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const { error } = await client.from("entities").update(stamp).eq("id", entityId);
      if (error) throw error;
      await serviceClient.from("entity_governance_events").insert({ entity_id: entityId, action: next, actor_id: userData.user.id });
      return response(200, { status: next }, requestOrigin);
    }

    if (operation === "add_alias") {
      const alias = text(payload?.alias); if (!alias) return response(400, { error: { message: "Sinônimo inválido." } }, requestOrigin);
      const { error } = await client.from("entity_aliases").insert({ entity_id: entityId, entity_type: entity.entity_type, alias, normalized_alias: normalized(alias) });
      if (error) return response(409, { error: { message: "Este sinônimo já existe ou conflita com outra entidade." } }, requestOrigin);
      await serviceClient.from("entity_governance_events").insert({ entity_id: entityId, action: "alias_added", actor_id: userData.user.id, details: { alias } });
      return response(201, { status: "alias_added" }, requestOrigin);
    }

    if (operation === "consolidate") {
      const targetId = typeof payload?.target_entity_id === "string" ? payload.target_entity_id : null;
      if (!targetId || targetId === entityId) return response(400, { error: { message: "Selecione outra entidade do mesmo tipo." } }, requestOrigin);
      const { data: target, error: targetError } = await client.from("entities").select("id, entity_type, governance_status").eq("id", targetId).single();
      if (targetError || !target || target.entity_type !== entity.entity_type || target.governance_status === "consolidated") return response(400, { error: { message: "A entidade destino deve existir, ter o mesmo tipo e estar ativa." } }, requestOrigin);
      const { error: consolidationError } = await serviceClient.rpc("consolidate_entities", { p_source_id: entityId, p_target_id: targetId, p_actor_id: userData.user.id });
      if (consolidationError) throw consolidationError;
      return response(200, { status: "consolidated", target_entity_id: targetId }, requestOrigin);
    }
    return response(400, { error: { message: "Operação não reconhecida." } }, requestOrigin);
  } catch (error) {
    console.error("Dictionary admin failed", error instanceof Error ? error.message : "unexpected_error");
    return response(500, { error: { message: "Não foi possível atualizar o dicionário." } }, requestOrigin);
  }
});
