# MVP 0 — implantação e validação

## Escopo

Este roteiro valida somente conectividade, estabilidade, JSON válido, tratamento de erro e proteção da chave Gemini. Não autoriza o início do MVP 1.

## Implantação

1. Crie um projeto Supabase e execute a migration em `supabase/migrations/20260918120000_mvp0_call_audits.sql`.
2. Defina os secrets no Supabase:
   - `GEMINI_API_KEY`: chave privada do Gemini;
   - `GEMINI_MODEL`: opcional; padrão `gemini-2.5-flash`;
   - `ALLOWED_ORIGIN`: URL exata do GitHub Pages, por exemplo `https://organizacao.github.io`.
3. Publique a função `analyze-perception`. A função requer o token anônimo do Supabase na chamada; mantenha a verificação JWT habilitada.
4. Preencha `js/config.js` com a URL e a chave anônima pública do Supabase.
5. Publique o conteúdo da raiz no GitHub Pages. Nunca publique a chave Gemini.

## Bateria de validação

Faça 30 chamadas pelo chat, distribuídas entre textos curtos, longos, acentuados e com caracteres especiais. Registre em planilha ou no relatório:

| Chamada | Sucesso | Latência (ms) | JSON válido | Observação |
| --- | --- | ---: | --- | --- |
| 1–30 |  |  |  |  |

Também valide deliberadamente:

- mensagem vazia: deve retornar erro 400;
- mensagem acima de 2.000 caracteres: deve retornar erro 400;
- método diferente de POST: deve retornar erro 405;
- origem diferente da configurada: o navegador não deve receber permissão CORS;
- chave Gemini: uma busca no repositório e no código publicado não deve encontrá-la;
- tabela `mvp0_call_audits`: deve registrar resultado e latência, sem o texto enviado.

## Gate de aprovação

O MVP 0 pode ser considerado pronto somente se as chamadas consecutivas apresentarem conectividade estável, o navegador receber exclusivamente JSON válido nas respostas de sucesso e os erros forem compreensíveis. Documente as falhas e os valores de latência antes de decidir se o MVP 1 será autorizado.
