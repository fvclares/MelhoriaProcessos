# Plataforma de Inteligência Operacional

Este repositório está na fase **MVP 7 — SaaS multiempresa (fundação com RLS)**.

O fluxo implementado nesta fase é:

```text
GitHub Pages (login) → Supabase Edge Function (resolve company via company_members + RLS) → Gemini → revisão humana → registro auditável → dicionário governado → indicadores → sugestões assistidas → semântica (isolados por empresa)
```

Isolamento multiempresa efetivo via RLS (`is_company_member`); a empresa é resolvida exclusivamente a partir do `auth.uid()` em cada operação, nunca via frontend. Similaridade/anomalias permanecem sinais sem automação.

## Preparação local

1. Preencha `js/config.js` com a URL do projeto Supabase e a chave anônima pública do projeto. A chave do Gemini não pertence ao frontend.
3. Aplique as migrations em `supabase/migrations/` no projeto Supabase, em ordem cronológica.
4. Cadastre os secrets da Edge Function:

   ```text
   GEMINI_API_KEY=<chave do Gemini>
   ALLOWED_ORIGIN=<url exata do GitHub Pages>
   ```

5. Crie empresas em `companies` e associe usuários em `company_members`, usando o papel `admin` para a governança e `member` para uso operacional.
6. Publique `supabase/functions/analyze-perception`, `supabase/functions/record-perception`, `supabase/functions/dictionary-admin`, `supabase/functions/operational-analytics`, `supabase/functions/knowledge-evolution` e `supabase/functions/semantic-intelligence` como Edge Functions (todas com `company_id` via RLS).
7. Publique a raiz do repositório no GitHub Pages.

Os roteiros de validação estão em [docs/MVP_VALIDATION.md](docs/MVP_VALIDATION.md), [docs/MVP1_VALIDATION.md](docs/MVP1_VALIDATION.md), [docs/MVP2_VALIDATION.md](docs/MVP2_VALIDATION.md), [docs/MVP3_VALIDATION.md](docs/MVP3_VALIDATION.md), [docs/MVP4_VALIDATION.md](docs/MVP4_VALIDATION.md), [docs/MVP5_VALIDATION.md](docs/MVP5_VALIDATION.md), [docs/MVP6_VALIDATION.md](docs/MVP6_VALIDATION.md) e [docs/MVP7_VALIDATION.md](docs/MVP7_VALIDATION.md) (baseline em `docs/MVP7_BASELINE_RESULTS.md`).

## Segurança

- `js/config.js` é público e pode conter apenas URL e chave anônima pública do Supabase.
- `GEMINI_API_KEY` existe somente nos secrets do Supabase.
- A Edge Function trata a resposta do Gemini como entrada não confiável e só devolve JSON que passou por validação.
