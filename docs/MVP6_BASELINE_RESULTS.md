# MVP 6 - resultado da validacao (Inteligencia semantica)

- Data: 2026-09-18. Migration `20260918170000_mvp6_semantic_intelligence.sql` aplicada via `supabase db push` (habilita `pgvector` em `extensions`, tabela `perception_embeddings` 768 dims, funcoes `unembedded_perceptions`, `semantic_neighbors`, `semantic_similar_pairs`, `operational_anomalies`).
- Edge Function `semantic-intelligence` (`supabase/functions/semantic-intelligence/index.ts`) deployada (fix payload embedding: `taskType`/`outputDimensionality` + `?key=`). `GEMINI_EMBEDDING_MODEL` nao definido -> padrao `gemini-embedding-001` (768) usado.
- Frontend publicado no GitHub Pages a partir de `main` (`ec6ef04` + fix `14259d3`): `semantic.html` + `js/semantic.js` no ar (`MVP 6 - Inteligencia semantica` confirmado via curl).

## Validacao

### 1 - Geracao de embeddings em lotes

`unembedded_perceptions` inicial: 17. `backfill` (admin, `p_limit=20`) gerou `embedded=17, remaining_batch_available=false` em 1 lote. Segunda chamada: `embedded=0`. `insights` mostra `embedded_perceptions=17`. `perception_embeddings` com `embedding_model=gemini-embedding-001` (17 linhas), `source_text` identico a `perceptions.original_text` (`same_text=true`), `created_at` rastreavel. Requer admin: nao-admin `backfill` -> `403 Este usuario nao possui acesso administrativo.` (`semantic-intelligence/index.ts:25`).

### 2 - Busca semantica "GRAN travou na inclusao"

`search` (admin, `p_threshold=0.72`) retornou 5 matches; top `87.4% - O GRAN trava quando tento incluir uma garantia.` (equivalente semantico apesar de "travou" vs "trava"), seguido de `82.8% - GRAN-MVP4-REC ...` etc. Confirma recuperacao de equivalencias com palavras diferentes. Nao-admin `search` -> `403`.

### 3 - Pares semanticos (candidatos, nao consolidacoes)

`insights` `semantic_pairs` (threshold 0.84) retornou 9 pares, ex: `94.3% CONSOLID-DESTINO-MVP3 <-> CONSOLID-ORIGEM-MVP3`, `90.8% GRAN-MVP4-REC duplicate`, `87.2% KRYPTON-MVP3 <-> CONSOLID-DESTINO`. Verificado via `semantic_similar_pairs` que nao houve `update`/`delete` em `classifications` ou `entities`; `classifications` permaneceu 17, `entities` 22 (mesmo antes/depois do embedding).

### 4 - Anomalias - concentracao recente

`operational_anomalies` (7 dias vs 30 anteriores) retornou `GRAN-MVP4-REC / PROCESSO-REC-MVP4 / erro` com `recent_occurrences=2, prior_daily_average=0, growth_ratio=null` (prior 0 -> qualifica por `recent_count>=2`). Concentracao criada no MVP4 aparece em `insights.anomalies`. Texto do limite respeitado: anomalia indica variacao, nao causa.

### 5 - Acesso administrativo

`insights`/`search`/`backfill` com token nao-admin (`mvp3-user@example.com`) -> `403`; sem token -> `401`. Apenas admin(`1727caa2-251e-488f-ad76-0305cbebc090`) acessa.

### 6 - Imutabilidade do dominio

Apos embedding: `perceptions` 17, `classifications` 17, `entity_relations` 1, `taxonomy_refinements` 1 inalterados; `perceptions.original_text = perception_embeddings.source_text` true; `dictionary_entity_summary` inalterado. Embedding nao tocou classificacao nem dicionario.

## Limites e gate

- Similaridade e sinal (`similarity` 0-1) sem consolidacao automatica; `semantic.html` declara "Compare relatos pelo significado" sem decisao.
- Anomalia = variacao vs 30 dias, nao causa comprovada (`operational_anomalies` calcula `growth_ratio = recent / (prior*7)`).
- Gate: embeddings rastreaveis (`embedding_model`, `source_text`), buscas recuperam equivalencias uteis (87.4% no caso GRAN), sinais apresentados sem automacao — **MVP 6 aprovado**.
