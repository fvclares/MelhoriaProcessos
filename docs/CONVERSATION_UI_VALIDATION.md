# Experiência conversacional — publicação e validação

## Objetivo

Substituir a apresentação de interpretação em formato de formulário por uma conversa: a pessoa relata uma situação, recebe uma síntese em linguagem comum e confirma ou ajusta a classificação antes do registro.

## Arquivos alterados

- `index.html`
- `js/app.js`
- `css/app.css`

## Publicação pelo Antigravity

1. Execute `npm run check` na raiz do repositório.
2. Publique apenas os três arquivos alterados acima e este roteiro.
3. Não aplique migration e não publique Edge Functions: o contrato da API não foi alterado.
4. Publique o GitHub Pages e valide no endereço público.

## Validação funcional

1. Faça login e confirme que a tela exibe a saudação do assistente e uma caixa de mensagem, sem JSON técnico ou formulário de classificação visível.
2. Envie um relato simples, por exemplo: `O GRAN trava quando tento incluir uma garantia.`
3. Confirme que o relato aparece como mensagem de **Você** e a síntese aparece como mensagem do **Assistente**.
4. Confirme que a pergunta `Posso registrar assim?` apresenta os dados compreendidos e os botões **Sim, pode registrar** e **Ajustar informações**.
5. Escolha **Sim, pode registrar** e confirme a mensagem de sucesso, seguida da possibilidade de enviar outro relato.
6. Em um novo relato, escolha **Ajustar informações**, corrija um campo e confirme o registro.
7. Envie um relato ambíguo ou com mais de um problema. Confirme que o assistente faz uma pergunta de esclarecimento, sem registrar automaticamente.
8. Valide em tela estreita de celular: mensagens, resumo e ações devem continuar legíveis e utilizáveis.

## Critério de aceite

O usuário percebe uma conversa natural e compreensível, mas a confirmação humana e a possibilidade de corrigir a classificação permanecem obrigatórias antes de qualquer persistência.
