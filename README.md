# Plataforma de Inteligência Operacional

Este repositório reúne os MVPs 0–7 e opera como uma plataforma de **instituição única**, com controle de acesso por papel.

O fluxo implementado nesta fase é:

```text
GitHub Pages (login) → Supabase Edge Function (valida acesso institucional) → Gemini → revisão humana → registro auditável → dicionário governado → indicadores → sugestões assistidas → semântica
```

O acesso é controlado por RLS e pelo papel institucional (`admin` ou `member`) associado ao `auth.uid()`. Similaridade e anomalias permanecem sinais sem automação.

## Preparação local

1. Preencha `js/config.js` com a URL do projeto Supabase e a chave anônima pública do projeto. A chave do Gemini não pertence ao frontend.
3. Aplique as migrations em `supabase/migrations/` no projeto Supabase, em ordem cronológica.
4. Cadastre os secrets da Edge Function:

   ```text
   GEMINI_API_KEY=<chave do Gemini>
   ALLOWED_ORIGIN=<url exata do GitHub Pages>
   ```

5. Cadastre os usuários da instituição em `user_roles`, usando `admin` para governança e `member` para uso operacional.
6. Publique `supabase/functions/analyze-perception`, `supabase/functions/record-perception`, `supabase/functions/dictionary-admin`, `supabase/functions/operational-analytics`, `supabase/functions/knowledge-evolution` e `supabase/functions/semantic-intelligence` como Edge Functions.
7. Publique a raiz do repositório no GitHub Pages.

## Configuração pública e sessão

- A URL e a `supabaseAnonKey` em `js/config.js` são identificadores públicos exigidos por um frontend estático; elas não concedem acesso administrativo e não devem ser substituídas por chave de serviço.
- A proteção efetiva está em RLS, papéis em `user_roles`, validação do JWT nas Edge Functions, CORS restritivo e limitação de chamadas no backend.
- O navegador guarda uma sessão temporária com `access_token` e `refresh_token`. O módulo `js/auth.js` renova o token antes de ele expirar e elimina as chaves usadas pelas versões anteriores ao sair.

Os roteiros de validação estão em [docs/MVP_VALIDATION.md](docs/MVP_VALIDATION.md), [docs/MVP1_VALIDATION.md](docs/MVP1_VALIDATION.md), [docs/MVP2_VALIDATION.md](docs/MVP2_VALIDATION.md), [docs/MVP3_VALIDATION.md](docs/MVP3_VALIDATION.md), [docs/MVP4_VALIDATION.md](docs/MVP4_VALIDATION.md), [docs/MVP5_VALIDATION.md](docs/MVP5_VALIDATION.md), [docs/MVP6_VALIDATION.md](docs/MVP6_VALIDATION.md), [docs/PHASE1_AUTH_VALIDATION.md](docs/PHASE1_AUTH_VALIDATION.md) e [docs/PHASE2_RESILIENCE_VALIDATION.md](docs/PHASE2_RESILIENCE_VALIDATION.md). Os documentos do MVP 7 permanecem como registro histórico do experimento multiempresa, substituído pela instituição única.

## Verificação local

Com Node.js 20 ou superior, execute `npm run check`. O comando verifica os módulos do navegador, os contratos mínimos das Edge Functions e os testes automatizados. O workflow `.github/workflows/quality.yml` executa a mesma verificação em cada push e pull request.

## Segurança

- `js/config.js` é público e pode conter apenas URL e chave anônima pública do Supabase.
- `GEMINI_API_KEY` existe somente nos secrets do Supabase.
- A Edge Function trata a resposta do Gemini como entrada não confiável e só devolve JSON que passou por validação.
