import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
};

type Mvp0Response = { reply: string; received_text_length: number; model: string };

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

function isMvp0Response(value: unknown): value is Mvp0Response {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.reply === "string" && data.reply.length > 0 &&
    typeof data.received_text_length === "number" && Number.isInteger(data.received_text_length) &&
    typeof data.model === "string" && data.model.length > 0;
}

async function audit(outcome: string, responseValid: boolean, model: string, latencyMs: number, errorCode?: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await client.from("mvp0_call_audits").insert({
    model, latency_ms: latencyMs, outcome, response_valid: responseValid, error_code: errorCode ?? null,
  });
  if (error) console.error("MVP0 audit failed", error.code);
}

Deno.serve(async (request) => {
  const origin = normalizeOrigin(request.headers.get("Origin"));
  const allowedOrigin = normalizeOrigin(Deno.env.get("ALLOWED_ORIGIN") ?? null);
  if (request.method === "OPTIONS") {
    if (allowedOrigin && origin === allowedOrigin) {
      return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowedOrigin } });
    }
    return json(403, { error: { code: "origin_not_allowed", message: "Origem não autorizada." } }, origin);
  }
  if (!allowedOrigin || origin !== allowedOrigin) {
    return json(403, { error: { code: "origin_not_allowed", message: "Origem não autorizada." } }, origin);
  }
  if (request.method !== "POST") return json(405, { error: { code: "method_not_allowed", message: "Use POST." } }, origin);

  const startedAt = Date.now();
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
  try {
    const payload = await request.json();
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    if (!message || message.length > 2000) {
      await audit("request_error", false, model, Date.now() - startedAt, "invalid_message");
      return json(400, { error: { code: "invalid_message", message: "Envie uma mensagem entre 1 e 2000 caracteres." } }, origin);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("gemini_not_configured");
    const prompt = `Você está validando conectividade técnica. Responda SOMENTE JSON válido, sem markdown, no formato {"reply":"confirmação breve","received_text_length":${message.length},"model":"${model}"}. Mensagem: ${JSON.stringify(message)}`;
    const providerResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    });
    if (!providerResponse.ok) throw new Error(`gemini_${providerResponse.status}`);

    const providerBody = await providerResponse.json();
    const rawText = providerBody?.candidates?.[0]?.content?.parts?.[0]?.text;
    let parsed: unknown;
    try { parsed = JSON.parse(rawText); } catch { parsed = null; }
    if (!isMvp0Response(parsed) || parsed.received_text_length !== message.length || parsed.model !== model) {
      await audit("invalid_ai_response", false, model, Date.now() - startedAt, "invalid_provider_json");
      return json(502, { error: { code: "invalid_provider_response", message: "A IA não retornou o contrato técnico esperado." } }, origin);
    }

    const latencyMs = Date.now() - startedAt;
    await audit("success", true, model, latencyMs);
    return json(200, { ...parsed, latency_ms: latencyMs }, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : "unexpected_error";
    await audit("provider_error", false, model, Date.now() - startedAt, code.slice(0, 100));
    console.error("MVP0 request failed", code);
    return json(502, { error: { code: "upstream_failure", message: "Falha temporária na conexão com a IA." } }, origin);
  }
});
