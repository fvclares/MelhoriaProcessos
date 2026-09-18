# MVP 4 — Inteligência de recorrência

## Publicação

1. Aplique a migration `20260918150000_mvp4_recurrence_intelligence.sql`.
2. Publique a Edge Function `operational-analytics`.
3. Publique `analytics.html` e `js/analytics.js` no GitHub Pages.
4. Use um usuário já autorizado por `ADMIN_USER_IDS` para acessar o painel.

## Validação

Crie ou utilize um conjunto de percepções confirmadas que inclua repetições conhecidas. Confirme que:

- a contagem total é igual ao número de linhas em `perceptions` que possuem classificação;
- uma combinação repetida de sistema, processo, subprocesso e categoria aparece em “Problemas recorrentes”;
- as somas por sistema e processo correspondem à classificação armazenada;
- a evolução diária coincide com `perceptions.created_at`;
- um usuário não administrador não acessa os indicadores;
- o painel declara que não há análise por unidade enquanto essa informação não for coletada.

## Limites

Recorrência neste MVP significa combinação exata dos campos classificados. Textos semanticamente equivalentes ainda não são agrupados; isso pertence ao MVP 6. Não há dashboard SaaS, multiempresa ou análise por unidade sem coleta explícita desse dado.

## Gate de aprovação

O MVP 4 fica aprovado quando os indicadores reproduzem os registros validados, tornam visíveis as concentrações e recorrências e não apresentam inferências além dos dados existentes.
