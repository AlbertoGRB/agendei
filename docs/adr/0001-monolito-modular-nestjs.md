# ADR 0001: Monolito modular em NestJS

- **Situação:** aceita
- **Data:** 2026-11-19

## Contexto

O agendei tem áreas bem definidas (contas, serviços, disponibilidade, reservas e notificações), uma pessoa desenvolvendo e um banco único. A reserva precisa checar e gravar o horário de forma atômica. O projeto também precisa de um processo separado para enviar e-mail pela fila, e a API precisa ser independente do front e documentada com Swagger, para atender outros clientes no futuro, como um app mobile.

## Decisão

Uma única base de código NestJS, organizada em módulos: `auth`, `users`, `catalog`, `availability`, `bookings` e `notifications`.

- Um módulo só usa outro pelo service que ele exporta, e nenhum módulo acessa a tabela de outro diretamente pelo Prisma.
- O mesmo código tem dois pontos de entrada: `main.ts` (API) e `worker.ts` (consumidor do RabbitMQ).
- O front em React (Vite) é um app separado, uma SPA que consome a API.

## Alternativas consideradas

- **Microsserviços:** rejeitado. É uma pessoa só, e a reserva viraria uma transação distribuída entre serviços, justo o ponto que o projeto quer resolver com simplicidade no banco.
- **Monolito em camadas, sem módulos:** rejeitado. O domínio tem áreas claras e o NestJS já organiza por módulo; sem fronteiras, as áreas passam a acessar as tabelas umas das outras.
- **Next.js full-stack:** rejeitado. Juntaria API e telas no mesmo app, e a API precisa ficar independente, documentada com Swagger, para atender também um app mobile.

## Consequências

- Positivas: um repositório, um banco e uma transação só para reservar; fronteiras claras entre áreas; API e worker reaproveitam o mesmo código; a API pode servir outros clientes além do front.
- Negativas: dois deploys (API e worker) e um front separado para configurar, com CORS e cookie entre domínios. A regra de dependência entre módulos depende de disciplina e de revisão; se o projeto crescer, vale uma checagem automática no lint.
