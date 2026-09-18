import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
};
function origin(value: string | null) { return value?.trim().replace(/\/$/, "") ?? null; }
function reply(status: number, body: unknown, requestOrigin: string | null) {
  const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed && allowed === origin(requestOrigin) ? allowed : (allowed ?? "") },
  });
}

Deno.serve(async (request) => {
  const requestOrigin = origin(request.headers.get("Origin"));
  const allowed = origin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  if (request.method === "OPTIONS") {
    return allowed && requestOrigin === allowed
      ? new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowed } })
      : reply(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  }
  if (!allowed || requestOrigin !== allowed) return reply(403, { error: { message: "Origem não autorizada." } }, requestOrigin);
  if (request.method !== "POST") return reply(405, { error: { message: "Use POST." } }, requestOrigin);

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !url || !serviceKey) return reply(401, { error: { message: "Autenticação necessária." } }, requestOrigin);
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !userData.user) return reply(401, { error: { message: "Autenticação necessária." } }, requestOrigin);

  try {
    const payload = await request.json().catch(() => ({}));
    const operation = payload?.operation ?? "list";
    if (operation === "set") {
      const companyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (!companyId) return reply(400, { error: { message: "Empresa inválida." } }, requestOrigin);
      const { data: membership } = await serviceClient.from("company_members").select("company_id").eq("user_id", userData.user.id).eq("company_id", companyId).maybeSingle();
      if (!membership) return reply(403, { error: { message: "Empresa inválida." } }, requestOrigin);
      const { error: upsertError } = await serviceClient.from("user_active_companies").upsert(
        { user_id: userData.user.id, company_id: companyId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      if (upsertError) throw upsertError;
    }
    const [{ data: companies, error: companiesError }, { data: activeCompanyId, error: activeError }] = await Promise.all([
      serviceClient.from("company_members").select("company_id, role, companies(name)").eq("user_id", userData.user.id),
      serviceClient.rpc("resolve_active_company", { p_user_id: userData.user.id }),
    ]);
    if (companiesError || activeError) throw companiesError ?? activeError;
    return reply(200, { companies: companies ?? [], active_company_id: activeCompanyId }, requestOrigin);
  } catch (error) {
    console.error("tenant-context failed", error instanceof Error ? error.message : "unexpected");
    return reply(500, { error: { message: "Não foi possível resolver a empresa ativa." } }, requestOrigin);
  }
});
