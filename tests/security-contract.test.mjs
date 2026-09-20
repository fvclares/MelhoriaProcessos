import test from "node:test";
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("configuração pública não contém secrets de servidor", async () => {
  const config = await read("js/config.js");
  assert.doesNotMatch(config, /SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY/i);
});

test("cliente renova sessões antes de chamar Edge Functions", async () => {
  const [auth, api] = await Promise.all([read("js/auth.js"), read("js/api.js")]);
  assert.match(auth, /refresh_token/);
  assert.match(auth, /REFRESH_SKEW_MS/);
  assert.match(api, /currentAccessToken\(\)/);
});

test("modelo Gemini padrão é explicitamente configurável", async () => {
  const source = await read("supabase/functions/analyze-perception/index.ts");
  assert.match(source, /Deno\.env\.get\("GEMINI_MODEL"\)/);
  assert.match(source, /gemini-3\.5-flash-lite/);
});

test("analista conduz a conversa antes de liberar validação", async () => {
  const source = await read("supabase/functions/analyze-perception/index.ts");
  assert.match(source, /ready_for_validation/);
  assert.match(source, /5W2H/);
  assert.match(source, /const analysisId = parsed\.ready_for_validation/);
});
