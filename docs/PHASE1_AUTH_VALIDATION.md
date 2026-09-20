# Fase 1 — Autenticação e configuração pública

## Objetivo

Centralizar o login, guardar `access_token` e `refresh_token` em sessão temporária e renovar o token antes de sua expiração. A chave anônima do Supabase continua pública por necessidade do GitHub Pages; a chave de serviço e os secrets do Gemini continuam exclusivamente no Supabase.

## Publicação pelo Antigravity

1. Revise e publique os arquivos locais alterados: `js/auth.js`, `js/api.js`, `js/app.js`, `js/admin.js`, `js/analytics.js`, `js/evolution.js`, `js/semantic.js` e `README.md`.
2. Não publique Edge Functions nem aplique migration nesta fase.
3. Publique o site estático no GitHub Pages.

## Validação

1. Abra a página principal em uma janela anônima e faça login.
2. Envie uma percepção e confirme o registro.
3. Abra `admin.html`, `analytics.html`, `evolution.html` e `semantic.html` na mesma janela: cada página deve reutilizar a sessão sem exigir novo login.
4. No DevTools, confirme que existe somente `institution-auth-session` no `sessionStorage`; `auth-token` e `dictionary-admin-token` não devem ser recriados.
5. Ajuste temporariamente o campo `expiresAt` dessa sessão para um valor anterior ao horário atual, recarregue a página e execute uma ação autenticada. A chamada deve renovar o token e concluir sem `401`.
6. Clique em **Sair**, recarregue a página e confirme que os controles autenticados permanecem ocultos até um novo login.
7. Confirme que `js/config.js` contém somente URL e chave anônima pública, sem `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` ou outro secret.

## Critério de aceite

Não há `401 Unauthorized` causado por JWT expirado durante o uso normal; o refresh acontece antes da chamada à Edge Function e todas as telas usam o mesmo módulo de autenticação.
