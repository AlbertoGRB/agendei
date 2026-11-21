# ADR 0003: Notificações por fila RabbitMQ

- **Situação:** aceita
- **Data:** 2026-11-19
- **Atualizada:** 2026-11-21, depois do estudo do RabbitMQ no ciclo 4 (novas tentativas no worker e registro na mesma transação do envio)

## Contexto

A reserva e o cancelamento precisam enviar e-mail. Enviar dentro da requisição deixa a resposta lenta e faz uma falha do servidor de e-mail derrubar a reserva (RNF03). Além disso, uma mensagem pode ser entregue mais de uma vez, e o cliente não pode receber o mesmo e-mail em dobro (RN12).

## Decisão

- A API grava a reserva e, em seguida, publica `booking.created` ou `booking.cancelled` no RabbitMQ (transporte de microsserviços do NestJS), respondendo na hora.
- Um worker (`worker.ts`, no mesmo código) consome a fila e envia o e-mail com o Nodemailer.
- A mensagem já carrega o que o e-mail precisa (nome, serviço, data e hora), para o módulo `notifications` não consultar as tabelas de outros módulos.
- O worker abre uma transação, insere uma linha em `Notification`, com chave única em (`bookingId`, `type`), e envia o e-mail. O commit só acontece depois que o servidor de e-mail aceitou a mensagem. Se a linha já existe, nada é enviado.
- Se o envio falhar, a transação é desfeita, a linha some e o worker tenta de novo, até 3 vezes, esperando 2 s e depois 10 s. Depois da terceira falha, o erro vai para o log.
- O worker confirma a mensagem ao RabbitMQ (ack) só no fim, depois do envio ou da desistência, e pega uma mensagem de cada vez.
- A fila é do tipo quorum, com limite de 3 entregas (`x-delivery-limit`). É a rede de proteção para a mensagem que derruba o worker antes do ack: na quarta entrega, o RabbitMQ a descarta.
- Se a publicação falhar, a reserva continua gravada, e o erro vai para o log.

### O que o estudo mostrou

A primeira versão desta decisão devolvia a mensagem à fila (`nack` com `requeue`) a cada falha, até 3 vezes. Numa fila quorum do RabbitMQ 4, isso não funciona: a mensagem devolvida volta na hora e o `nack` não conta como entrega, então ela voltaria sem fim, sem espera entre as tentativas. O limite de entregas só conta a mensagem que fica sem resposta porque o consumidor caiu. Por isso as tentativas ficaram no worker, e o limite da fila ficou só para o caso de queda.

A primeira versão também gravava a linha de `Notification` antes do envio e preenchia `sentAt` depois. Com isso, uma nova tentativa encontraria a linha e pularia o e-mail que não saiu. Gravar e enviar na mesma transação resolve sem coluna de estado: a linha só existe se o e-mail saiu. Quando a mesma mensagem chega duas vezes ao mesmo tempo, a segunda transação espera a primeira na chave única e, depois do commit dela, não insere nada.

## Alternativas consideradas

- **Enviar o e-mail dentro da requisição:** o mais simples, mas deixa a reserva lenta e a falha do SMTP vira falha da reserva.
- **BullMQ com Redis:** menos peças para quem já usa Redis, mas o projeto não tem Redis, e o RabbitMQ é o broker mais pedido em vagas e tem suporte nativo no NestJS.
- **Devolver a mensagem à fila com espera:** exigiria uma fila de espera com tempo de vida (TTL) e uma troca de mensagens mortas (DLX) para trazê-la de volta. Funciona, mas são duas filas a mais para algo que um laço com espera resolve no próprio worker.
- **Cron lendo uma tabela:** um processo periódico busca envios pendentes. Evita um broker, mas atrasa o e-mail até a próxima execução e vira consulta repetida ao banco.

## Consequências

- Positivas: a reserva responde rápido e independe do e-mail; o worker pode cair e voltar sem perder mensagens; a chave única protege contra duplicidade, inclusive em reentrega.
- Negativas: mais dois serviços para rodar (RabbitMQ e worker). Durante o envio, a transação segura uma conexão do banco, por no máximo uns 20 s, que é a soma dos tempos limite do SMTP; com uma mensagem por vez, é uma conexão só. Se o banco cair entre o aceite do e-mail e o commit, a próxima entrega manda o e-mail de novo; a janela é curta, e um e-mail em dobro nesse caso raro é melhor do que um e-mail perdido. Se a publicação falhar logo depois de gravar a reserva, o e-mail daquela reserva se perde; a solução completa seria um padrão de caixa de saída (outbox), que fica para depois, junto com a fila de mensagens mortas (DLQ) e o lembrete 24 h antes.
