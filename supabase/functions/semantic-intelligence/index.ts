import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DIMENSIONS = 768;
const corsHeaders = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json; charset=utf-8" };
function origin(value: string | null) { return value?.trim().replace(/\/$/, "") ?? null; }
function reply(status: number, body: unknown, requestOrigin: string | null) { const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null); return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed && allowed === origin(requestOrigin) ? allowed : (allowed ?? "") } }); }
function vector(values: unknown) { return Array.isArray(values) && values.length === DIMENSIONS && values.every((value) => typeof value === "number" && Number.isFinite(value)) ? `[${values.join(",")}]` : null; }

async function embed(text: string, apiKey: string, model: string) {
  const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] }, taskType: "SEMANTIC_SIMILARITY", outputDimensionality: DIMENSIONS }) });
  if (!upstream.ok) {
    const body = await upstream.text().catch(() => "");
    console.error("embedding upstream failed", upstream.status, body.slice(0, 300));
    throw new Error(`embedding_${upstream.status} ${body.slice(0, 120)}`);
  }
  const data = await upstream.json(); const result = vector(data?.embedding?.values);
  if (!result) throw new Error("invalid_embedding_response");
  return result;
}

Deno.serve(async (request) => {
  const requestOrigin = origin(request.headers.get("Origin")); const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  if (request.method === "OPTIONS") return allowed && requestOrigin === allowed ? new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed } }) : reply(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (!allowed || requestOrigin !== allowed) return reply(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (request.method !== "POST") return reply(405, { error: { message: "Use POST." } }, requestOrigin);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, ""); const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !key) return reply(401, { error: { message: "Autenticação administrativa necessária." } }, requestOrigin);
  const client = createClient(url, key, { auth: { persistSession: false } }); const { data: userData, error: userError } = await client.auth.getUser(token); const admins = (Deno.env.get("ADMIN_USER_IDS") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (userError || !userData.user || !admins.includes(userData.user.id)) return reply(403, { error: { message: "Este usuário não possui acesso administrativo." } }, requestOrigin);

  try {
    const payload = await request.json(); const operation = payload?.operation; const apiKey = Deno.env.get("GEMINI_API_KEY"); const model = Deno.env.get("GEMINI_EMBEDDING_MODEL") ?? "gemini-embedding-001";
    if (operation === "insights") {
      const [{ data: pairs, error: pairsError }, { data: anomalies, error: anomaliesError }, { count, error: countError }] = await Promise.all([
        client.rpc("semantic_similar_pairs", { p_threshold: 0.84, p_limit: 100 }), client.rpc("operational_anomalies"), client.from("perception_embeddings").select("*", { count: "exact", head: true }),
      ]);
      if (pairsError || anomaliesError || countError) throw pairsError ?? anomaliesError ?? countError;
      return reply(200, { embedded_perceptions: count ?? 0, semantic_pairs: pairs ?? [], anomalies: anomalies ?? [] }, requestOrigin);
    }
    if (!apiKey) throw new Error("gemini_not_configured");
    if (operation === "search") {
      const query = typeof payload?.query === "string" ? payload.query.trim() : ""; if (!query || query.length > 2000) return reply(400, { error: { message: "Informe uma busca de até 2.000 caracteres." } }, requestOrigin);
      const embedding = await embed(query, apiKey, model); const { data, error } = await client.rpc("semantic_neighbors", { p_embedding: embedding, p_threshold: 0.72, p_limit: 20 });
      if (error) throw error; return reply(200, { matches: data ?? [] }, requestOrigin);
    }
    if (operation === "backfill") {
      const { data: pending, error } = await client.rpc("unembedded_perceptions", { p_limit: 20 }); if (error) throw error;
      const rows = [];
      for (const perception of pending ?? []) { const embedding = await embed(perception.original_text, apiKey, model); rows.push({ perception_id: perception.perception_id, embedding, embedding_model: model, source_text: perception.original_text }); }
      if (rows.length) { const { error: insertError } = await client.from("perception_embeddings").upsert(rows, { onConflict: "perception_id" }); if (insertError) throw insertError; }
      return reply(200, { embedded: rows.length, remaining_batch_available: (pending ?? []).length === 20 }, requestOrigin);
    }
    return reply(400, { error: { message: "Operação não reconhecida." } }, requestOrigin);
  } catch (error) {
    console.error("Semantic intelligence failed", error instanceof Error ? error.message : "unexpected_error");
    return reply(500, { error: { message: "Não foi possível processar a inteligência semântica." } }, requestOrigin);
  }
});
