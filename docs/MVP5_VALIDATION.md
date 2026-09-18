# MVP 5 — Evolução assistida do conhecimento

## Publicação

1. Aplique a migration `20260918160000_mvp5_assisted_knowledge_evolution.sql`.
2. Publique a Edge Function `knowledge-evolution`.
3. Publique `evolution.html` e `js/evolution.js` no GitHub Pages.
4. Acesse o painel com um usuário listado em `ADMIN_USER_IDS`.

## Validação

1. Gere sugestões e confirme que elas entram como `pending` sem alterar entidades, relações ou taxonomia.
2. Aprove uma sugestão `discover`: a entidade indicada deve se tornar `homologated`.
3. Aprove uma sugestão `group`: a entidade fonte deve ser consolidada na entidade destino, preservando evidências.
4. Aprove uma sugestão `relate`: deve surgir uma relação explícita entre as entidades indicadas.
5. Aprove uma sugestão `refine`: a proposta deve ficar registrada em `taxonomy_refinements`; ela não deve reclassificar automaticamente registros antigos.
6. Rejeite uma sugestão e confirme que nenhum dado operacional foi alterado.
7. Gere sugestões novamente e confirme que sugestões idênticas não são duplicadas.

## Gate de aprovação

O MVP 5 fica aprovado quando toda proposta tem origem e resposta bruta rastreáveis, entra inicialmente como pendente e só provoca alteração após decisão humana identificada.
