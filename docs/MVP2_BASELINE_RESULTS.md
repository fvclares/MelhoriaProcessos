# MVP 2 — resultado da validação (confirmação e persistência)

- Data: 2026-09-18. Migration `20260918130000_mvp2_confirmation_and_persistence.sql` aplicada via `supabase db push`.
- Edge Functions `analyze-perception` e `record-perception` redeployadas; front publicado no GitHub Pages a partir de `main` (MVP 2 no ar).
- Segredos: `GEMINI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` somente no Supabase; navegador usa só a chave anônima pública.

## Fluxo feliz — 11 relatos

Para cada relato: envio → `analysis_id` → revisão com 0–1 campo alterado → confirmação → `perception_id`.

| # | relato | campo alterado | perception_id (prefixo) |
| --- | --- | --- | --- |
| a1 | O GRAN trava quando tento incluir uma garantia. | categoria→erro (IA já propôs `erro`; sem divergência) | 3c31de32 |
| a2 | O GAX mostra uma mensagem de erro ao concluir a operação. | nenhum | ace607d5 |
| a3 | O sistema de crédito não carrega os dados do cliente. | nenhum | 6ba0428f |
| a4 | A aprovação de garantia está demorando muito. | nenhum | 98282dc7 |
| a5 | O processo de crédito tem etapas demais. | nenhum | 3cf1ebcb |
| a6 | O campo CPF aceita um formato e depois acusa erro. | nenhum | 3f565b5a |
| a7 | Não consigo acessar o menu de crédito. | nenhum | c4a6a8ad |
| a8 | O GRAN fica louco quando vou salvar. | processo→“salvamento de registro” | 18cd04d1 |
| a9 | Deu pau no cadastro de novo. | nenhum | 55ea656d |
| a10 | Como consulto a garantia de um cliente? | nenhum | 74f6d656e |
| a11 | A equipe resolveu meu problema rapidamente. | categoria→`outro` (IA propôs null) | c41a99a6 |

## Estado do banco após a bateria

| tabela | linhas | conferência |
| --- | --- | --- |
| perceptions | 11 | uma por confirmação, com o texto original |
| ai_interpretations | 11 | `prompt_version=mvp1.0.0`, `raw_response` e `interpretation` presentes |
| classifications | 11 | valores finais (finais = proposta da IA + correções) |
| corrections | 2 | só divergências reais: a8.processo (null→texto) e a11.categoria_problema (null→`outro`) |
| analysis_sessions consumidas | 11 | todas retêm `raw_response` + `proposed_interpretation` (reconstrução) |
| analysis_sessions abertas | 3 | n2 (expirada), n3 (dois problemas, sem confirmação), n4 (sem confirmação) |

## Casos negativos

| caso | resultado esperado | obtido |
| --- | --- | --- |
| Envio duplo da mesma sessão (n1) | 409 `analysis_session_unavailable` | OK |
| Sessão expirada (n2, `expires_at` forçado ao passado) | 409 `analysis_session_unavailable` | OK |
| Sessão inexistente | 409 `analysis_session_unavailable` | OK |
| Classificação inválida | 400 `invalid_confirmation` | OK |
| Relato com dois problemas (n3) | `single_issue=false`, sem tela de confirmação | OK |
| Recarga antes da confirmação (n4) | nenhuma linha em `perceptions` | OK (`perceptions`=11) |

## Gate de aprovação

- Todo registro confirmado é reconstruível: texto original (`perceptions`) + proposta da IA (`analysis_sessions`) + classificação final (`classifications`) + diffs (`corrections`). **Atendido.**
- Nenhum relato não confirmado foi gravado em `perceptions` (n2/n3/n4 fora da tabela). **Atendido.**
- MVP 2 **aprovado**.
