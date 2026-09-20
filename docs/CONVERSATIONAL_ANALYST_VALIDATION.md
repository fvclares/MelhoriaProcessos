# Analista conversacional — publicação e validação

## Publicação pelo Antigravity

1. Execute `npm run check` na raiz.
2. Publique `supabase/functions/analyze-perception` e os arquivos `js/api.js`, `js/app.js`, `index.html`, `css/app.css`, `docs/AI_CONTRACT.md` e este roteiro.
3. Não aplique migration: a conversa é mantida pelo cliente até a validação e usa as tabelas existentes.
4. Publique o GitHub Pages após a Edge Function.

## Cenário principal

1. Entre na aplicação e envie: `poderiam melhorar o sistema de busca de veículos`.
2. A IA deve perguntar pelo processo ou contexto, sem mostrar resumo de validação.
3. Responda: `No financiamento de veículos.`
4. A IA deve investigar a dificuldade, impacto, frequência ou expectativa com uma pergunta curta.
5. Responda: `É muito difícil localizar um veículo quando o cliente informa poucos dados.`
6. Somente quando houver compreensão suficiente, a IA deve apresentar uma síntese e liberar a revisão com **Sim, pode registrar** ou **Ajustar informações**.
7. Confirme o registro e valide o retorno de sucesso.
8. Após a confirmação, valide que o assistente pergunta se há outra percepção a compartilhar ou se a pessoa prefere encerrar.
9. Selecione **Compartilhar outra**: o campo de mensagem deve permanecer disponível e receber o foco.
10. Selecione **Encerrar conversa** em uma nova execução: o campo de mensagem deve ser ocultado, mantendo a sessão autenticada e exibindo a despedida do assistente.

## Casos de borda

- Uma mensagem com dois problemas deve gerar uma pergunta para escolher ou separar o tema principal.
- Dados insuficientes devem manter `ready_for_validation=false` e não gerar `analysis_id`.
- A conversa deve retornar `400 invalid_conversation` se exceder 12 mensagens ou 2.000 caracteres do usuário.
- O resumo pode ser ajustado pelo usuário antes do registro; sem confirmação, nada é persistido.

## Critério de aceite

A experiência conduz uma investigação progressiva e natural, sem liberar a classificação logo após a primeira mensagem, mantendo a validação humana obrigatória.
