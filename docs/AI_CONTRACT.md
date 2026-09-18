# Contrato de IA — MVP 1

Versão: `mvp1.0.0`. A resposta é um objeto JSON; campos ausentes, tipos incorretos, valores de `confidence` fora de 0–1 ou valores fora das taxonomias são rejeitados pelo backend.

```json
{
  "single_issue": true,
  "interpretation": "Erro ao incluir garantia no sistema GRAN.",
  "fields": {
    "tipo": { "value": "reclamacao", "evidence": "observed", "confidence": 0.92 },
    "processo": { "value": "Garantias", "evidence": "inferred", "confidence": 0.88 },
    "subprocesso": { "value": "Inclusão", "evidence": "observed", "confidence": 0.91 },
    "sistema": { "value": "GRAN", "evidence": "observed", "confidence": 0.96 },
    "categoria_problema": { "value": "erro", "evidence": "inferred", "confidence": 0.90 }
  },
  "context": ["ao salvar a garantia"],
  "entity_candidates": [],
  "clarification_required": false,
  "clarification_question": null,
  "confirmation_required": true
}
```

Taxonomia provisória de `tipo`: `reclamacao`, `sugestao`, `duvida`, `elogio`, `outro`.

Taxonomia provisória de `categoria_problema`: `erro`, `lentidao`, `acesso`, `usabilidade`, `integracao`, `processo`, `informacao`, `outro`.

`processo`, `subprocesso` e `sistema` são texto extraído, não valores homologados. Um valor `null` exige esclarecimento. `confidence` é sinal heurístico e não autoriza nenhuma decisão automática.
