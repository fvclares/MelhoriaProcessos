# MVP 3 — Dicionário Operacional Evolutivo

## Publicação

1. Aplique a migration `20260918140000_mvp3_operational_dictionary.sql`.
2. Publique novamente a Edge Function `record-perception` e publique `dictionary-admin`.
3. Crie no Supabase Auth pelo menos um usuário administrativo e registre seu UUID no secret `ADMIN_USER_IDS`. Caso existam vários, separe os UUIDs por vírgula.
4. Publique `admin.html`, `js/admin.js` e os demais arquivos atualizados no GitHub Pages.

`ADMIN_USER_IDS` é um secret do Supabase; ele nunca deve estar no frontend.

## Fluxo a validar

1. Confirme uma percepção com processo, subprocesso ou sistema ainda desconhecido.
2. Verifique que o conceito aparece no painel como `candidate`, com frequência e texto de origem.
3. Entre com um usuário que não esteja em `ADMIN_USER_IDS`: o painel deve negar alterações.
4. Entre como administrador e homologue um candidato; confira o evento de governança.
5. Adicione um sinônimo e confirme que ele fica vinculado à entidade correta.
6. Consolide duas entidades do mesmo tipo; confira que as evidências passam para o destino, a origem fica `consolidated` e seu nome vira sinônimo do destino.
7. Rejeite um candidato e confira a trilha em `entity_governance_events`.

## Gate de aprovação

O MVP 3 está aprovado quando candidatos surgem de percepções confirmadas, toda alteração de governança é feita por administrador identificado e é possível navegar de uma entidade até as evidências que explicam sua origem.
