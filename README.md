# Plataforma de Inteligência Operacional

Este repositório está na fase **MVP 0 — Fundação Técnica**.

O único fluxo implementado nesta fase é:

```text
GitHub Pages → Supabase Edge Function → Gemini → JSON validado → navegador
```

Não há classificação operacional, dicionário, embeddings ou persistência de percepções nesta etapa.

## Preparação local

1. Preencha `js/config.js` com a URL do projeto Supabase e a chave anônima pública do projeto. A chave do Gemini não pertence ao frontend.
3. Aplique a migration em `supabase/migrations/20260918120000_mvp0_call_audits.sql` no projeto Supabase.
4. Cadastre os secrets da Edge Function:

   ```text
   GEMINI_API_KEY=<chave do Gemini>
   ALLOWED_ORIGIN=<url exata do GitHub Pages>
   ```

5. Publique `supabase/functions/analyze-perception` como Edge Function.
6. Publique a raiz do repositório no GitHub Pages.

O roteiro completo de implantação e validação está em [docs/MVP_VALIDATION.md](docs/MVP_VALIDATION.md).

## Segurança

- `js/config.js` é público e pode conter apenas URL e chave anônima pública do Supabase.
- `GEMINI_API_KEY` existe somente nos secrets do Supabase.
- A Edge Function trata a resposta do Gemini como entrada não confiável e só devolve JSON que passou por validação.
