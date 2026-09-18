# MVP 2 — confirmação e persistência

## Publicação

1. Aplique primeiro a migration `20260918130000_mvp2_confirmation_and_persistence.sql` no Supabase.
2. Publique novamente `analyze-perception` e publique a nova Edge Function `record-perception`.
3. Publique o frontend atualizado no GitHub Pages.
4. Mantenha `GEMINI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` somente nos secrets do Supabase. A chave anônima pública continua sendo a única chave usada pelo navegador.

## Fluxo a validar

Para pelo menos dez relatos, confirme que a pessoa consegue:

1. enviar um relato de um único problema;
2. revisar a interpretação;
3. alterar um ou mais campos;
4. confirmar o registro;
5. receber o identificador do registro criado.

No banco, valide para cada confirmação:

- uma linha em `perceptions` com o texto original;
- uma linha em `ai_interpretations` com versão do prompt, resposta bruta e interpretação;
- uma linha em `classifications` com os valores finais;
- zero ou mais linhas em `corrections`, somente nos campos alterados.

Também valide: envio duplo da mesma sessão (deve ser recusado), sessão expirada (deve ser recusada), relato com dois problemas (não deve exibir confirmação) e recarga da página antes da confirmação (não deve criar uma percepção).

## Gate de aprovação

O MVP 2 fica aprovado somente se todo registro confirmado for reconstruível pelo texto original, pela proposta da IA e pela classificação final, e se nenhum relato não confirmado for gravado em `perceptions`.
