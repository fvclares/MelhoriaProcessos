# MVP 4 - resultado da validacao (Inteligencia de recorrencia)

- Data: 2026-09-18. Migration `20260918150000_mvp4_recurrence_intelligence.sql` aplicada via `supabase db push` (views `recurrence_summary` e `recurrence_daily`).
- Edge Function `operational-analytics` (`supabase/functions/operational-analytics/index.ts`) deployada; `ADMIN_USER_IDS` ja configurado no MVP3 (`mvp3-admin@example.com` / `1727caa2-251e-488f-ad76-0305cbebc090`).
- Frontend publicado no GitHub Pages a partir de `main` (`b0114e7`): `analytics.html` + `js/analytics.js` no ar (`MVP 4` confirmado via curl).

## Conjunto de dados utilizado

Apos MVP2 (11) + MVP3 (3 percepcoes novas: KRYPTON + CONSOLID origem/destino) + 1 percepcao extra entre migracoes, totalizava 15 percepcoes classificadas. Para demonstrar recorrencia exata foram criadas 2 percepcoes identicas:

- `GRAN-MVP4-REC / PROCESSO-REC-MVP4 / SUB-REC-MVP4 / erro` x2 (IDs `da3afd8a`, `d81c3fef`)

Total final: **17 percepcoes validadas**.

## Validacoes

| Item | Esperado | Obtido | Status |
| --- | --- | --- | --- |
| Contagem total | `total_validated_perceptions` = linhas em `perceptions` com `classifications` | 17 = 17 (`select count(*) from perceptions where id in (select perception_id from classifications)`) | OK |
| Problemas recorrentes | combinacao repetida (sistema, processo, subprocesso, categoria) com `occurrences >1` | `GRAN-MVP4-REC | PROCESSO-REC-MVP4 | SUB-REC-MVP4 | erro =2` aparece em `top_recurrences` e `recurring_combinations=1` | OK |
| Somas por sistema | `by_system` = `select coalesce(sistema,'Nao informado'), sum(occurrences) from recurrence_summary group by sistema` | `Nao informado:9, GRAN-MVP4-REC:2, GRAN:2, sistema de credito:1, FEMP:1, KRYPTON-MVP3:1, GAX:1` identico nos dois lados | OK |
| Somas por processo | idem por `processo` | `PROCESSO-REC-MVP4:2, Nao informado:2, credito:2, ...` identico | OK |
| Evolucao diaria | `daily_evolution` somado por `occurrence_date` = `perceptions.created_at::date` | `recurrence_daily` total 17 em 2026-09-18 = soma do payload (`2026-09-18:17`) | OK |
| Nao-admin | `operational-analytics` com token de `mvp3-user@example.com` deve negar | `403 {"message":"Este usuario nao possui acesso administrativo."}` (`operational-analytics/index.ts:22`) | OK |
| Sem token | negar | `Invalid JWT` | OK |
| Unidade | painel declara ausencia | `unit_coverage.message = "Unidade nao e coletada no fluxo atual; nao ha concentracao por unidade a reportar."` exibido em `#unit-coverage` (`analytics.html:30`) | OK |

## Limites respeitados

- Recorrencia e combinacao exata dos quatro campos classificados; `analytics.html` declara "recorrencia exata, nao similaridade semantica" e o backend nao faz agrupamento semantico (limite do MVP4).
- Sem analise por unidade: confirmado pela mensagem de `unit_coverage` e ausencia de coluna unidade no banco.

## Gate de aprovacao

Indicadores reproduzem exatamente os registros validados (contagens, concentracoes, evolucao), tornam visiveis concentracoes (`by_system`/`by_process`) e recorrencia (`top_recurrences` com `occurrences=2`), e nao inferem alem dos dados. **MVP 4 aprovado**.
