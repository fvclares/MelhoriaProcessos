import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json; charset=utf-8" };
function origin(value: string | null) { return value?.trim().replace(/\/$/, "") ?? null; }
function reply(status: number, body: unknown, requestOrigin: string | null) {
  const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed && allowed === origin(requestOrigin) ? allowed : (allowed ?? "") } });
}
async function consumeRateLimit(client: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await client.rpc("consume_edge_rate_limit", { p_scope: "operational-analytics", p_user_id: userId, p_limit: 30, p_window_seconds: 60 });
  if (error) throw error; const result = Array.isArray(data) ? data[0] : data;
  return result?.allowed ? 0 : Number(result?.retry_after_seconds ?? 60);
}

Deno.serve(async (request) => {
  const requestOrigin = origin(request.headers.get("Origin")); const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  if (request.method === "OPTIONS") return allowed && requestOrigin === allowed ? new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed } }) : reply(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (!allowed || requestOrigin !== allowed) return reply(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (request.method !== "POST") return reply(405, { error: { message: "Use POST." } }, requestOrigin);

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !anonKey || !serviceKey) return reply(401, { error: { message: "Autenticação administrativa necessária." } }, requestOrigin);
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !userData.user) return reply(403, { error: { message: "Este usuário não possui acesso administrativo." } }, requestOrigin);
  const { data: adminCheck } = await serviceClient.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
  if (!adminCheck || adminCheck.role !== "admin") return reply(403, { error: { message: "Este usuário não possui acesso administrativo." } }, requestOrigin);
  try { const retryAfter = await consumeRateLimit(serviceClient, userData.user.id); if (retryAfter) return reply(429, { error: { code: "rate_limited", message: "Muitas consultas em pouco tempo. Tente novamente em instantes.", retry_after_seconds: retryAfter } }, requestOrigin); }
  catch { return reply(503, { error: { code: "rate_limit_unavailable", message: "Controle temporariamente indisponível. Tente novamente." } }, requestOrigin); }
  const client = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });

  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") return reply(400, { error: { code: "invalid_json", message: "Envie um JSON válido." } }, requestOrigin);
    const [summaryResult, dailyResult] = await Promise.all([
      client.from("recurrence_summary").select("*").order("occurrences", { ascending: false }).limit(50),
      client.from("recurrence_daily").select("*").gte("occurrence_date", new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)).order("occurrence_date"),
    ]);
    if (summaryResult.error || dailyResult.error) throw summaryResult.error ?? dailyResult.error;
    const rows = summaryResult.data ?? [];
    const grouped = (key: string) => Object.entries(rows.reduce((acc: Record<string, number>, row) => { const name = String(row[key] ?? "Não informado"); acc[name] = (acc[name] ?? 0) + Number(row.occurrences); return acc; }, {})).map(([name, occurrences]) => ({ name, occurrences })).sort((a, b) => b.occurrences - a.occurrences);
    return reply(200, {
      total_validated_perceptions: rows.reduce((total, row) => total + Number(row.occurrences), 0),
      recurring_combinations: rows.filter((row) => row.occurrences > 1).length,
      top_recurrences: rows,
      by_system: grouped("sistema"),
      by_process: grouped("processo"),
      daily_evolution: dailyResult.data ?? [],
      unit_coverage: { available: false, message: "Unidade não é coletada no fluxo atual; não há concentração por unidade a reportar." },
    }, requestOrigin);
  } catch (error) {
    console.error("Operational analytics failed", error instanceof Error ? error.message : "unexpected_error");
    return reply(500, { error: { message: "Não foi possível gerar os indicadores operacionais." } }, requestOrigin);
  }
});
