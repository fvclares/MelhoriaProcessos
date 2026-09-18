# MVP 6 — Inteligência semântica

## Publicação

1. Aplique a migration `20260918170000_mvp6_semantic_intelligence.sql`. Ela habilita `pgvector` e cria as funções de busca e similaridade.
2. Publique a Edge Function `semantic-intelligence`.
3. Publique `semantic.html` e `js/semantic.js`.
4. Opcionalmente defina `GEMINI_EMBEDDING_MODEL`; o padrão é `gemini-embedding-001` com 768 dimensões.

## Validação

1. Gere embeddings em lotes até não haver registros pendentes.
2. Busque “GRAN travou na inclusão” e confirme que relatos equivalentes, ainda que com palavras diferentes, aparecem com alta similaridade.
3. Inspecione os pares semânticos; eles são candidatos de recorrência, não consolidações automáticas.
4. Crie ou use uma concentração recente de uma combinação operacional e confirme que ela aparece em anomalias.
5. Verifique que a busca e a geração de embeddings exigem usuário administrativo.
6. Confirme que texto original, classificação e dicionário não foram alterados pelo processo de embedding.

## Limites

Similaridade é um sinal, não uma decisão. Os pares não mudam classificações nem dicionário, e uma anomalia indica variação em relação aos 30 dias anteriores, não causa comprovada.

## Gate de aprovação

O MVP 6 fica aprovado quando embeddings são gerados de forma rastreável, buscas semânticas recuperam equivalências úteis e os sinais de similaridade/anomalia são apresentados sem automação de decisões.
