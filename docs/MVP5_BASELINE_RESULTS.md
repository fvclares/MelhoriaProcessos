# MVP 5 - resultado da validacao (Evolucao assistida do conhecimento)

- Data: 2026-09-18. Migration `20260918160000_mvp5_assisted_knowledge_evolution.sql` aplicada via `supabase db push` (tabelas `knowledge_suggestions`, `entity_relations`, `taxonomy_refinements` + funcao `review_knowledge_suggestion`).
- Edge Function `knowledge-evolution` (`supabase/functions/knowledge-evolution/index.ts`) deployada (fix modelo para `gemini-3.5-flash-lite`); secret `ADMIN_USER_IDS` ja configurado no MVP3.
- Frontend publicado no GitHub Pages a partir de `main` (`fea09a3`): `evolution.html` + `js/evolution.js` no ar (`MVP 5 - Evolucao assistida`, intro "Nenhuma sugestao altera o dicionario sem aprovacao humana" confirmado via curl).

## Validacao passo a passo

### 1 - Geracao entra como pending sem alterar operacional

Antes: `knowledge_suggestions=0`. Apos `generate` (admin): `created=10, ignored=0`, `list` mostra 10 `pending` (4 discover, 2 group, 2 relate, 2 refine), todos com `prompt_version=mvp5.0.0`, `raw_response` e `evidence` presentes. `entities`/`entity_relations`/`taxonomy_refinements` inalterados. Nao-admin `generate` -> `403 Este usuario nao possui acesso administrativo.` (`knowledge-evolution/index.ts:19`).

### 2 - Aprovar discover -> homologacao

Aprovado `discover` `c5eb910d-90b4-4af2-a162-1f0c43e13310` (GRAN-MVP4-REC). Entidade passou de `candidate` para `homologated`; `entity_governance_events` com `homologated` e `actor_id` admin (1 linha). `knowledge_suggestions` ficou `approved` com `reviewed_by` admin.

### 3 - Aprovar group -> consolidacao

Aprovado `group` `fcc84162-964b-496f-95e2-5fec02c007b4` (sistema de credito) -> `554c1a2d-221f-42eb-bb53-cf69c2f08943` (GRAN). Fonte ficou `consolidated` com `consolidated_into` destino; `entity_aliases` destino ganhou alias `sistema de credito`; evidencias preservadas via `consolidate_entities`.

### 4 - Aprovar relate -> relacao explicita

Aprovado `relate` `eaa03ff9-cc00-44e2-bf0b-126f9006e6b6` -> `c5eb910d-90b4-4af2-a162-1f0c43e13310`. Criada linha em `entity_relations` com `relation_type=associated_with`, `evidence_count=0`, `approved_by` admin. `total_relations` foi de 0 para 1.

### 5 - Aprovar refine -> taxonomy_refinements sem reclassificacao

Aprovado `refine` `parent=credito` `proposed=propostas de credito` com `rationale`. Linha em `taxonomy_refinements` com `status=approved` e `evidence` presente. `classifications` permaneceu 17 (nenhum registro antigo reclassificado).

### 6 - Rejeitar -> nenhum dado operacional alterado

Rejeitado `discover` `0ee40d03-f0ac-46e2-9194-c3983aa47f98` -> `rejected` com `reviewed_by` admin. Verificado: nenhuma nova linha em `entity_relations`/`taxonomy_refinements`/`entity_aliases` e `classifications` ainda 17; `entity_governance_events` nao criou homologacao para a entidade rejeitada.

### 7 - Gerar novamente -> sem duplicatas

Segunda chamada `generate` retornou `created=6, ignored=1`, total foi de 10 para 16 (`pending` de 5 para 11). `fingerprint` unico (`knowledge_suggestions.fingerprint`) impediu duplicacao via `upsert(..., onConflict: "fingerprint", ignoreDuplicates: true)` (`knowledge-evolution/index.ts:57`).

## Gate de aprovacao

- Toda proposta tem `proposal`, `evidence`, `raw_response` e `prompt_version` rastreaveis e entra como `pending` — **atendido** (10 iniciais todas pending com raw_response).
- So provoca alteracao apos decisao humana identificada (`review_knowledge_suggestion` com `p_actor_id` = admin UUID) — **atendido** (4 approved geraram homologacao/consolidacao/relacao/refinamento com `approved_by`/`actor_id`; 1 rejected sem efeito).

MVP 5 **aprovado**.
