# ADR 0003: Notificações por fila RabbitMQ

- **Situação:** aceita
- **Data:** 2026-11-19

## Contexto

A reserva e o cancelamento precisam enviar e-mail. Enviar dentro da requisição deixa a resposta lenta e faz uma falha do servidor de e-mail derrubar a reserva (RNF03). Além disso, uma mensagem pode ser entregue mais de uma vez, e o cliente não pode receber o mesmo e-mail em dobro (RN12).

## Decisão

- A API grava a reserva e, em seguida, publica `booking.created` ou `booking.cancelled` no RabbitMQ (transporte de microsserviços do NestJS), respondendo na hora.
- Um worker (`worker.ts`, no mesmo código) consome a fila e envia o e-mail com o Nodemailer.
- A mensagem já carrega o que o e-mail precisa (nome, serviço, data e hora), para o módulo `notifications` não consultar as tabelas de outros módulos.
- Antes de enviar, o worker insere uma linha em `Notification`, com chave única em (`bookingId`, `type`). Se a linha já existe, a mensagem é confirmada sem enviar nada.
- Se o envio falhar, a mensagem volta à fila, até 3 tentativas; depois disso, o erro vai para o log.
- Se a publicação falhar, a reserva continua gravada, e o erro vai para o log.

## Alternativas consideradas

- **Enviar o e-mail dentro da requisição:** o mais simples, mas deixa a reserva lenta e a falha do SMTP vira falha da reserva.
- **BullMQ com Redis:** menos peças para quem já usa Redis, mas o projeto não tem Redis, e o RabbitMQ é o broker mais pedido em vagas e tem suporte nativo no NestJS.
- **Cron lendo uma tabela:** um processo periódico busca envios pendentes. Evita um broker, mas atrasa o e-mail até a próxima execução e vira consulta repetida ao banco.

## Consequências

- Positivas: a reserva responde rápido e independe do e-mail; o worker pode cair e voltar sem perder mensagens; a chave única protege contra duplicidade, inclusive em reentrega.
- Negativas: mais dois serviços para rodar (RabbitMQ e worker). Se a publicação falhar logo depois de gravar a reserva, o e-mail daquela reserva se perde; a solução completa seria um padrão de caixa de saída (outbox), que fica para depois, junto com a fila de mensagens mortas (DLQ) e o lembrete 24 h antes.
