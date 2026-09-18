# MVP 7 - resultado da validacao (SaaS multiempresa com RLS)

- Data: 2026-09-18. Migrations `20260918180000_mvp7_saas_foundation.sql` (empresas, membros, unidades, company_id, RLS select) + `20260918181000_mvp7_rls_enforcement.sql` (politicas INSERT/UPDATE/DELETE tenant-aware + funcoes `register_entity_evidence`, `persist_validated_perception`, `consolidate_entities`, `review_knowledge_suggestion` e funcoes semanticas com `is_company_member`) + `20260918182000_fix_mvp7_classifications.sql` (company_id em classifications/ai_interpretations/corrections e politicas) aplicadas via `supabase db push`.
- Edge Functions adaptadas para resolver empresa via `company_members` a partir do usuario autenticado (nunca via frontend): `analyze-perception`, `record-perception`, `dictionary-admin`, `operational-analytics`, `knowledge-evolution`, `semantic-intelligence` (`supabase/functions/*/index.ts`). Todas exigem `Authorization: Bearer <user JWT>` e criam `userClient` com `anonKey + Bearer` para RLS (`is_company_member`).
- `company_members` populada: `Organizacao inicial` (229f60d8) com `mvp3-admin@example.com` (admin) e `mvp3-user@example.com` (member); `Empresa B` (13066c6f) com `mvp7-b@example.com` (admin). `ADMIN_USER_IDS` atualizado para `1727caa2...,d5f2284b...` (comma, sem espaco).
- Frontend `index.html` + `js/app.js` + `js/api.js` atualizado para login obrigatorio (`auth-token`/`dictionary-admin-token` compartilhado) e `analyzePerception`/`recordPerception` com token. Publicado no GitHub Pages via `main`.

## Validacao de isolamento (duas empresas)

### 1 - Criacao com empresa correta

- `mvp7-b` criou percepcao `KRYPTON-B` -> `perceptions.company_id = Empresa B` (bac19bb8, d365d4ce, 8a76d406...). `mvp3-admin` criou `UNIQUE-A` -> `perceptions.company_id = Organizacao inicial` (01b6101b). Verificado via `select company_id from perceptions`.

### 2 - Leitura isolada por RLS

- `GET /rest/v1/perceptions` com `mvp3-admin` retornou 19 linhas (so Organizacao inicial); com `mvp7-b` retornou 4 linhas (so Empresa B). `classifications` via REST: `mvp3-admin` 17, `mvp7-b` 3 (isolado). `is_company_member` correto.

### 3 - Dicionario

- `dictionary-admin list` com `mvp3-admin` -> 24 entidades (Organizacao inicial); com `mvp7-b` -> 2 entidades (Empresa B). `detail`/`homologate` cross-company retorna 404.

### 4 - Analytics

- `operational-analytics` com `mvp3-admin` -> `total_validated_perceptions=18` (Organizacao inicial); com `mvp7-b` -> `3` (Empresa B). `by_system`/`by_process` somam apenas da propria empresa. Nao-admin `mvp3-user` (member) acessa analytics (200) pois e `authenticated` e membro, mas nao-admin `dictionary-admin` negado 403.

### 5 - Conhecimento e semantica

- `knowledge-evolution list/generate` com `mvp7-b` retorna apenas sugestoes da Empresa B (company_id filtrado via RLS + `fingerprint` com `company_id`). `semantic-intelligence insights` com `mvp3-admin` -> `embedded_perceptions=17` (Organizacao inicial), com `mvp7-b` -> `0` antes do backfill e `4` apos (isolado). `search "UNIQUE-A"` com `mvp3-admin` retorna o proprio (isolado), com `mvp7-b` retorna 0 (cross-company 0). `backfill` com `mvp3-admin` gera apenas para Organizacao inicial (2), com `mvp7-b` apenas para Empresa B (4).

### 6 - Nao autenticado / sem empresa

- `analyze-perception` sem token ou com `anon` -> `401 auth_required` / `403 company_not_found`. Usuario sem `company_members` -> `403 company_not_found`.

### 7 - RLS efetiva (nao apenas declarada)

- `perceptions`, `classifications`, `entities`, `perception_embeddings` etc com `enable row level security` e politicas `tenant select/insert/update` usando `is_company_member(company_id)`. Teste direto `select is_company_member('229f60d8...')` com `mvp7-b` retorna false, com `mvp3-admin` true. `persist_validated_perception` e `register_entity_evidence` verificam `is_company_member` explicitamente e falham com `company_not_authorized` se cruzado.

## Gate de aprovacao

- Isolamento multiempresa efetivo via RLS, com empresa resolvida exclusivamente por `company_members` a partir do `auth.uid()` em cada operacao Edge Function — **atendido**.
- Nenhum dado, embedding, entidade ou indicador vaza entre empresas; usuario de Empresa B nao consulta dados da Organizacao inicial e vice-versa — **atendido**.
- Frontend nao envia `company_id`; backend resolve — **atendido**.

MVP 7 **aprovado** como fundacao SaaS segura (RLS como camada adequada, conforme docs Supabase).
