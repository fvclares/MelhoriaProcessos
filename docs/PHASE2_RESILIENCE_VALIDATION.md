# Fase 2 — Limites e resiliência das Edge Functions

## Alterações incluídas

- Migration `20260920120000_edge_function_rate_limits.sql`: contador atômico por usuário e por função, em janela de 60 segundos.
- Limites: `analyze-perception` 10/min, `record-perception` 20/min, `dictionary-admin` 60/min, `operational-analytics` 30/min, `knowledge-evolution` 5/min e `semantic-intelligence` 20/min.
- Resposta `429` com `retry_after_seconds` quando um limite é atingido; `503` se o controle não puder ser consultado.
- Resposta `400 invalid_json` para corpo malformado nas seis funções.
- O padrão de `GEMINI_MODEL` permanece `gemini-3.5-flash-lite`, que deve ser preservado ou substituído por um identificador válido configurado como secret no Supabase.

## Publicação pelo Antigravity

1. Aplique a migration `supabase/migrations/20260920120000_edge_function_rate_limits.sql`.
2. Confirme os secrets: `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash-lite`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-001` e `ALLOWED_ORIGIN` com a URL exata do GitHub Pages.
3. Publique as seis Edge Functions: `analyze-perception`, `record-perception`, `dictionary-admin`, `operational-analytics`, `knowledge-evolution` e `semantic-intelligence`.
4. Não há alteração de interface nem publicação de GitHub Pages nesta fase.

## Validação

1. Com usuário autenticado, envie um JSON inválido a cada função; espere `400` e `error.code = invalid_json`.
2. Faça 11 chamadas válidas a `analyze-perception` em até 60 segundos com o mesmo usuário. As dez primeiras devem seguir o fluxo normal; a décima primeira deve retornar `429 rate_limited` e `retry_after_seconds` maior que zero.
3. Espere o intervalo informado e confirme que uma nova chamada é aceita.
4. Repita o teste com outro usuário: o limite deve ser independente.
5. Faça uma interpretação válida e confirme um registro; valide que o fluxo operacional continua funcionando.
6. Nos logs, confirme que o modelo efetivamente usado é o valor de `GEMINI_MODEL` e que não há erro de modelo inexistente.

## Critério de aceite

Nenhuma Edge Function aceita rajadas ilimitadas de um mesmo usuário, JSON malformado não é reportado como erro interno e o modelo Gemini configurado responde normalmente.
