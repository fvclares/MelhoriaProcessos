# MVP 1 — validação da interpretação

## Antes de testar

1. Publique novamente a Edge Function `analyze-perception`.
2. Mantenha `GEMINI_API_KEY`, `GEMINI_MODEL` e `ALLOWED_ORIGIN` configurados apenas no Supabase.
3. Publique os arquivos atualizados no GitHub Pages.

## Bateria inicial

Use [MVP1_TEST_CASES.md](MVP1_TEST_CASES.md) como conjunto inicial de 50 relatos. Para cada caso, registre a avaliação humana por campo: tipo, processo, subprocesso, sistema, categoria e contexto.

Além da acurácia, registre: taxa de `single_issue=false`, taxa de esclarecimento, taxa de JSON rejeitado e latência.

## Gate de aprovação

Não há meta numérica pré-definida nesta primeira bateria: a finalidade é estabelecer a linha de base e identificar onde a IA falha. O MVP 1 é aprovado quando todos os resultados foram revisados, os erros foram categorizados e as taxonomias provisórias foram confirmadas ou ajustadas. Somente então o MVP 2 pode ser iniciado.
