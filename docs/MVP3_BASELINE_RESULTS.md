# MVP 3 — resultado da validação (Dicionário Operacional Evolutivo)

- Data: 2026-09-18. Migration `20260918140000_mvp3_operational_dictionary.sql` aplicada via `supabase db push` (backfill de 16 evidências das classificações MVP2).
- Edge Functions `record-perception` (republicada) e `dictionary-admin` (nova) deployadas. Secret `ADMIN_USER_IDS=1727caa2-251e-488f-ad76-0305cbebc090` configurado (usuário `mvp3-admin@example.com`); segundo usuário `mvp3-user@example.com` criado para teste negativo. `GEMINI_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY` seguem só no Supabase.
- Frontend publicado no GitHub Pages a partir de `main` (`652d44d`): `admin.html` + `js/admin.js` + `index.html` MVP3 no ar (`MVP 3 · Administração` confirmado via curl).

## Fluxo 1 — conceito novo como `candidate`

Percepção confirmada: `KRYPTON-MVP3 / FLUXO-KRYPTON-MVP3 / VALIDACAO-KRYPTON-MVP3` → `perception 55a81d15`. No painel `list` (admin) os três novos conceitos apareceram como `candidate` com `evidence_count=1`. `detail` de `FLUXO-KRYPTON-MVP3` retornou 1 evidência com `perceptions.original_text` idêntico ao relato e 0 sinônimos.

## Fluxo 3 — painel nega alterações a não-admin

`mvp3-user@example.com` (fora de `ADMIN_USER_IDS`) tentou `homologate` → `403 {"message":"Este usuário não possui acesso administrativo."}`.

## Fluxo 4 — homologação por admin

Admin homologou `FLUXO-KRYPTON-MVP3` (`c91210dc`) → `200 homologated`. `list` passou a `homologated`. `entity_governance_events` registrou `homologated` com `actor_id=1727caa2`.

## Fluxo 5 — sinônimo

Admin adicionou `FLUXO-KRYPTON-ALIAS` a `FLUXO-KRYPTON-MVP3` → `201 alias_added`. `detail` passou a listar o sinônimo; `entity_governance_events` com `alias_added` + `details {alias}` e `entity_aliases` com 1 linha.

## Fluxo 6 — consolidação

Criadas duas entidades processo `CONSOLID-ORIGEM-MVP3` (ad651695, ev=1) e `CONSOLID-DESTINO-MVP3` (7164a63d, ev=1). Admin consolidou origem → destino via `consolidate_entities(p_source, p_target, p_actor)`:
- evidências da origem movidas para destino (destino `evidence_count` foi de 1 para 2; `entity_evidence` confirma 2 linhas no destino, 0 na origem);
- origem ficou `consolidated` com `consolidated_into = destino`;
- `entity_aliases` destino ganhou sinônimo `CONSOLID-ORIGEM-MVP3`;
- `entity_governance_events` com `consolidated`, `target_entity_id=destino`.

## Fluxo 7 — rejeição

Admin rejeitou `KRYPTON-MVP3` (`12513329`) → `200 rejected`; `list` confirma `rejected`; `entity_governance_events` com `rejected` e `actor_id` do admin.

## Estado final do dicionário

`entities`: 19 total (16 candidate, 1 homologated, 1 rejected, 1 consolidated). Todos os `governance_events` (4) têm `actor_id` do admin. Nenhum `ADMIN_USER_IDS` no frontend (grep vazio). Navegação entidade → evidências → relato original validada via `detail` e via SQL.

## Gate de aprovação

- Candidatos surgem de percepções confirmadas: **atendido** (backfill + 3 novos conceitos MVP3 com evidência).
- Toda alteração com admin identificado: **atendido** (4 eventos com `actor_id`).
- Navegável até a origem: **atendido** (detail + `entity_evidence` ↔ `perceptions`).

MVP 3 **aprovado**.
