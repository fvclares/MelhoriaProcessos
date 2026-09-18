# Plataforma de Inteligência Operacional

Este repositório está na fase **MVP 2 — Confirmação e persistência**.

O fluxo implementado nesta fase é:

```text
GitHub Pages → Supabase Edge Function → Gemini → revisão humana → registro auditável
```

Não há dicionário operacional, homologação de entidades, analytics ou embeddings nesta etapa.

## Preparação local

1. Preencha `js/config.js` com a URL do projeto Supabase e a chave anônima pública do projeto. A chave do Gemini não pertence ao frontend.
3. Aplique as migrations em `supabase/migrations/` no projeto Supabase, em ordem cronológica.
4. Cadastre os secrets da Edge Function:

   ```text
   GEMINI_API_KEY=<chave do Gemini>
   ALLOWED_ORIGIN=<url exata do GitHub Pages>
   ```

5. Publique `supabase/functions/analyze-perception` e `supabase/functions/record-perception` como Edge Functions.
6. Publique a raiz do repositório no GitHub Pages.

Os roteiros de validação estão em [docs/MVP_VALIDATION.md](docs/MVP_VALIDATION.md), [docs/MVP1_VALIDATION.md](docs/MVP1_VALIDATION.md) e [docs/MVP2_VALIDATION.md](docs/MVP2_VALIDATION.md).

## Segurança

- `js/config.js` é público e pode conter apenas URL e chave anônima pública do Supabase.
- `GEMINI_API_KEY` existe somente nos secrets do Supabase.
- A Edge Function trata a resposta do Gemini como entrada não confiável e só devolve JSON que passou por validação.
