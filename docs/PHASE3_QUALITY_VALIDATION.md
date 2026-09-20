# Fase 3 — Qualidade, testes e documentação

## Alterações incluídas

- `package.json` com os comandos `npm run lint`, `npm test` e `npm run check`.
- Testes automatizados de contrato para configuração pública, renovação de sessão e modelo Gemini.
- Verificação estrutural das seis Edge Functions: tratamento de JSON, rate limit e resposta `429`.
- Workflow GitHub Actions em `.github/workflows/quality.yml` para push e pull request.
- Documentação atualizada para distinguir o MVP 7 multiempresa histórico do modelo atual de instituição única.
- `supabase/.temp/` confirmado como ignorado e não versionado.

## Publicação pelo Antigravity

1. Execute `npm run check` na raiz do repositório. O resultado deve terminar com zero falhas.
2. Revise o workflow `.github/workflows/quality.yml` e publique todos os arquivos locais pendentes das Fases 1, 2 e 3.
3. No GitHub, confirme a execução bem-sucedida do workflow **Quality gate** para o commit publicado.
4. Não aplique migrations nem publique Edge Functions nesta fase; essas ações pertencem à Fase 2.

## Critério de aceite

- `npm run check` passa localmente e no GitHub Actions.
- Nenhum arquivo de `supabase/.temp/` aparece em arquivos rastreados pelo Git.
- A documentação principal descreve instituição única e identifica o conteúdo multiempresa apenas como histórico.
