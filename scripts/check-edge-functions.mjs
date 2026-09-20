import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const functions = [
  "analyze-perception",
  "record-perception",
  "dictionary-admin",
  "operational-analytics",
  "knowledge-evolution",
  "semantic-intelligence",
];

for (const name of functions) {
  const source = await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), "utf8");
  assert.match(source, /request\.json\(\)\.catch\(\(\) => null\)/, `${name}: JSON malformado deve ser tratado`);
  assert.match(source, /consume_edge_rate_limit/, `${name}: rate limit transacional ausente`);
  assert.match(source, /rate_limited/, `${name}: resposta 429 ausente`);
}
