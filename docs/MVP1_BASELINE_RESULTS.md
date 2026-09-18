# MVP 1 — resultado da bateria inicial (linha de base)

- Data: 2026-09-18. Origem dos casos: `docs/MVP1_TEST_CASES.md` (50 relatos).
- Edge Function `analyze-perception` redeployada; contrato `mvp1.0.0`; modelo `gemini-3.5-flash-lite`.
- Front publicado no GitHub Pages a partir de `main`.
- Cada caso foi enviado uma vez via POST com `Origin: https://fvclares.github.io`.

## Métricas de máquina

| Métrica | Valor |
| --- | --- |
| Casos executados | 50 |
| Sucesso (`success`) | 50 (100%) |
| JSON rejeitado (`invalid_provider_response`) | 0 (0%) |
| Falhas de infraestrutura (`upstream_failure` etc.) | 0 (0%) |
| `single_issue=false` | 2 (4%) — casos 41 e 48 |
| Esclarecimento solicitado | 36 (72%) |
| Latência média | 1631 ms |
| Latência p95 | 2496 ms |

### Distribuição de `tipo`

| tipo | casos |
| --- | --- |
| reclamacao | 41 |
| duvida | 6 |
| sugestao | 1 |
| elogio | 2 |

### Distribuição de `categoria_problema`

| categoria | casos |
| --- | --- |
| erro | 18 |
| lentidao | 9 |
| usabilidade | 7 |
| informacao | 6 |
| processo | 3 |
| acesso | 3 |
| outro | 2 |
| null (elogios 46 e 50) | 2 |

## Pontos para revisão humana (gate do MVP 1)

1. Caso 1 (“trava”) classificado como `lentidao`; avaliar se `erro` seria mais adequado.
2. Casos 46 e 50 (elogios) retornaram `categoria_problema=null` sem esclarecimento — confrontar com a regra 2 (“valor null exige esclarecimento”).
3. Caso 45 (sugestão) classificado como `usabilidade`; avaliar contra `processo`/`outro`.
4. Confirmar se os 36 esclarecimentos pedem apenas o campo ausente, sem inventar fatos (regra 2).
5. Casos 41 e 48: `single_issue=false` com pergunta de priorização — comportamento esperado pela regra 1; validar o texto das perguntas.

## Tabela por caso (extraída da execução)

| id | grupo | single_issue | tipo | processo | subprocesso | sistema | categoria | esclarec.? | lat(ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | sistema-erro | True | reclamacao | inclusao de garantia |  | GRAN | lentidao | False | 1528 |
| 2 | sistema-erro | True | reclamacao | Operação |  | GAX | erro | False | 1436 |
| 3 | sistema-erro | True | reclamacao |  |  | SAP | erro | True | 1491 |
| 4 | sistema-erro | True | reclamacao | cadastro |  |  | erro | True | 1626 |
| 5 | sistema-erro | True | reclamacao | crédito |  | sistema de crédito | erro | False | 1464 |
| 6 | sistema-erro | True | reclamacao |  |  | GRAN | erro | True | 1689 |
| 7 | sistema-erro | True | reclamacao |  |  |  | erro | True | 1391 |
| 8 | sistema-erro | True | reclamacao | inclusao |  |  | erro | True | 1450 |
| 9 | sistema-erro | True | reclamacao | garantias |  |  | erro | True | 1689 |
| 10 | sistema-erro | True | reclamacao | anexar documento |  |  | erro | True | 4258 |
| 11 | processo-lentidao | True | reclamacao | aprovação de garantia |  |  | lentidao | False | 2496 |
| 12 | processo-lentidao | True | reclamacao | cadastro |  |  | lentidao | True | 1410 |
| 13 | processo-lentidao | True | reclamacao | consulta de limite |  |  | lentidao | True | 1596 |
| 14 | processo-lentidao | True | reclamacao | crédito |  |  | processo | False | 1711 |
| 15 | processo-lentidao | True | reclamacao |  |  |  | processo | True | 2201 |
| 16 | processo-lentidao | True | reclamacao | liberacao |  |  | processo | True | 1674 |
| 17 | processo-lentidao | True | reclamacao | Análise | Correção |  | informacao | False | 1477 |
| 18 | processo-lentidao | True | reclamacao | inclusao manual |  |  | lentidao | True | 1411 |
| 19 | processo-lentidao | True | reclamacao | atualização de status |  |  | lentidao | True | 1363 |
| 20 | processo-lentidao | True | reclamacao | atendimento |  |  | lentidao | False | 1142 |
| 21 | interface-acesso | True | duvida |  |  |  | usabilidade | True | 1281 |
| 22 | interface-acesso | True | reclamacao |  |  |  | erro | True | 1470 |
| 23 | interface-acesso | True | reclamacao |  |  | celular | usabilidade | True | 1897 |
| 24 | interface-acesso | True | reclamacao | crédito |  |  | acesso | False | 1345 |
| 25 | interface-acesso | True | reclamacao | consultar garantias |  |  | acesso | True | 1370 |
| 26 | interface-acesso | True | reclamacao |  |  |  | usabilidade | True | 1625 |
| 27 | interface-acesso | True | reclamacao |  |  |  | usabilidade | True | 1095 |
| 28 | interface-acesso | True | reclamacao |  |  |  | acesso | True | 1591 |
| 29 | interface-acesso | True | reclamacao |  |  |  | usabilidade | True | 1506 |
| 30 | interface-acesso | True | duvida |  |  |  | informacao | True | 1345 |
| 31 | informal | True | reclamacao |  |  | GRAN | erro | False | 1768 |
| 32 | informal | True | reclamacao | fechar a proposta |  | GAX | lentidao | False | 1936 |
| 33 | informal | True | reclamacao |  |  | MIRA | erro | True | 1627 |
| 34 | informal | True | reclamacao |  |  |  | erro | True | 1847 |
| 35 | informal | True | reclamacao | garantias |  |  | outro | True | 1507 |
| 36 | informal | True | reclamacao | cadastro |  |  | erro | True | 1278 |
| 37 | informal | True | reclamacao | aprovação | parada |  | erro | True | 1748 |
| 38 | informal | True | reclamacao |  |  | Zeta | lentidao | True | 1176 |
| 39 | informal | True | duvida |  |  | ROTA | informacao | True | 1579 |
| 40 | informal | True | reclamacao | Inclusão |  |  | usabilidade | True | 1489 |
| 41 | ambiguidade | False | reclamacao | inclusão | aprovação | GRAN | erro | True | 1731 |
| 42 | ambiguidade | True | reclamacao |  |  |  | erro | True | 1856 |
| 43 | ambiguidade | True | reclamacao |  |  |  | outro | True | 1517 |
| 44 | ambiguidade | True | duvida |  |  |  | informacao | True | 1534 |
| 45 | ambiguidade | True | sugestao | cadastro |  |  | usabilidade | False | 1346 |
| 46 | ambiguidade | True | elogio |  |  |  |  | False | 1251 |
| 47 | ambiguidade | True | duvida | proposta | alteração de status |  | informacao | True | 1777 |
| 48 | ambiguidade | False | reclamacao |  |  |  | erro | True | 1464 |
| 49 | ambiguidade | True | duvida | cadastro de garantia |  |  | informacao | False | 1430 |
| 50 | ambiguidade | True | elogio |  |  |  |  | False | 2663 |


Colunas `processo/subprocesso/sistema` vazias indicam valor `null` (campo não determinável).
