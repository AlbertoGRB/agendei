# Plano de ação: agendei

## 1. Metodologia

**Kanban com ciclos semanais**, um Scrumban adaptado para uma pessoa.

O Scrum puro pressupõe um time com papéis separados (Product Owner, Scrum Master e desenvolvedores) e cerimônias feitas para alinhar várias pessoas. Num projeto de uma pessoa, daily e planning viram burocracia. Por isso o plano usa o quadro do Kanban e aproveita do Scrum só o que funciona para uma pessoa:

| Vem do Scrum | Vem do Kanban |
|---|---|
| backlog priorizado (as histórias do levantamento, com prioridade MoSCoW) | quadro visual com o fluxo do trabalho |
| ciclos curtos, de 1 semana, cada um com uma meta | limite de trabalho em andamento: no máximo 2 cards em "Fazendo" |
| revisão no fim de cada ciclo | puxar a próxima tarefa só quando a atual termina |
| Definição de Pronto | |

## 2. Ferramentas e fluxo

- **Quadro:** GitHub Projects com as colunas Backlog → Pronto para começar → Fazendo (máx. 2) → Em revisão → Feito.
- **Issues:** uma por história ou tarefa técnica, com os critérios de aceite copiados do [levantamento](01-requisitos.md).
- **Milestones:** uma por ciclo, com a meta escrita em uma frase.
- **Branches:** `main` protegida, uma branch por issue (`feat/14-criar-reserva`), pull request com checklist e merge com squash.
- **Commits:** Conventional Commits em português (`feat: bloqueia reserva sobreposta com constraint de exclusão`).
- **Versões:** tag ao fim de cada ciclo (`v0.1.0`, `v0.2.0`, `v0.3.0`), com o MVP em `v1.0.0`.

## 3. Definição de Preparado (para começar uma issue)

- Critérios de aceite escritos.
- O que a issue precisa de outras já está pronto.
- Cabe em até 2 dias. Se não couber, é dividida.

## 4. Definição de Pronto

- Critérios de aceite atendidos.
- Testes escritos e passando no CI.
- Lint e checagem de tipos sem erro.
- Rota nova ou alterada documentada no Swagger.
- Nenhum segredo no código; `.env.example` atualizado se surgiu variável nova.
- Rota que mexe em dado de um usuário tem teste "usuário A não acessa dado do B".
- README ou docs atualizados quando o comportamento muda.
- Pull request revisado com o checklist e mergeado.

## 5. Cronograma

Capacidade: no máximo 5 dias de trabalho planejados por ciclo. O que não couber vai para o ciclo seguinte, em vez de apertar a semana.

| Ciclo | Meta | Issues | Dias planejados | Versão |
|---|---|---|---|---|
| 1 | "Consigo criar conta, entrar e a base está no CI" | 1 a 7 | 5 | `v0.1.0` |
| 2 | "O prestador cadastra serviços e horários, e o cliente vê os horários livres" | 8 a 12 | 5 | `v0.2.0` |
| 3 | "Reservar nunca duplica horário, e dá para criar conta e entrar pelo navegador" | 13 a 17 | 5 | `v0.3.0` |
| 4 | "O e-mail sai pela fila, e o cliente reserva pelo navegador" | 18 a 20 | 4,5 | `v0.4.0` |
| 5 | "Dá para usar tudo pelo navegador, e o projeto está no ar" | 21 a 25 | 5 | `v1.0.0` |

O ciclo 4 fica com meio dia de folga porque traz o que é mais novo e mais arriscado: o primeiro uso do RabbitMQ e do worker (issue 18), além do fluxo principal do front.

## 6. Backlog inicial

Estimativa: **P** = meio dia, **M** = 1 dia, **G** = 2 dias.

| # | Tipo | Issue | Origem | Ciclo | Tamanho |
|---|---|---|---|---|---|
| 1 | chore | Configurar NestJS, TypeScript strict, oxlint, Prettier e Swagger | RNF07, RNF10 | 1 | P |
| 2 | chore | docker-compose com PostgreSQL, RabbitMQ e Mailpit, e `.env.example` | RNF08 | 1 | P |
| 3 | chore | Schema do Prisma e primeira migração | RN02, RN13 | 1 | P |
| 4 | chore | CI com Postgres de teste: lint, tipos, testes, build e `npm audit` | RNF07, RNF04 | 1 | P |
| 5 | feat | Cadastro e login com bcrypt | US01, RF01, RF02, RN11 | 1 | M |
| 6 | feat | Renovação com rotação do token e hash no banco, e logout | US01, RF02, RN14 | 1 | M |
| 7 | feat | Guardas por papel, limite de requisições, helmet e CORS | US01, RNF04, RN09, RN11 | 1 | M |
| 8 | feat | Serviços do prestador: criar, editar e desativar | US02, RF03, RF04, RN01, RN02, RN10 | 2 | M |
| 9 | feat | Disponibilidade semanal (`PUT /availability`) | US03, RF05, RN03 | 2 | M |
| 10 | feat | Listar prestadores e seus serviços ativos | US05, RF07, RN10 | 2 | P |
| 11 | feat | Função pura de horários livres, com testes | US05, RF08, RN04, RN05, RN06, RN13 | 2 | G |
| 12 | feat | Rota `slots` | US05, RF08, RN13, RNF01 | 2 | P |
| 13 | feat | Front: Vite, rotas, TanStack Query, cadastro e login com token em memória | US01, RF01, RF02, RNF05 | 3 | M |
| 14 | feat | Migração SQL da constraint de exclusão e criar reserva com `409` | US06, RF09, RF13, RN05, RN07, RNF02 | 3 | G |
| 15 | feat | Cancelar reserva (cliente até 2 h antes, prestador a qualquer hora antes do início) | US07, US08, RF11, RF12, RN08, RN09 | 3 | M |
| 16 | test | Concorrência: reservas simultâneas, uma `201` e as demais `409` | US06, RF13, RNF02 | 3 | P |
| 17 | feat | Agenda do dia do prestador | US04, RF06, RN09, RN13 | 3 | P |
| 18 | feat | Fila: publicar no RabbitMQ, worker, e-mail no Mailpit e registro de envio com chave única | US06, US07, US08, RF14, RF15, RN12, RNF03, RNF09 | 4 | G |
| 19 | test | Worker: a mesma mensagem processada duas vezes envia um e-mail só | RN12 | 4 | P |
| 20 | feat | Front do cliente: prestadores, serviços, calendário, horários e confirmação | US05, US06, RF07, RF08, RF09, RNF05, RNF06 | 4 | G |
| 21 | feat | Front do cliente: minhas reservas e cancelamento | US07, RF10, RF11 | 5 | P |
| 22 | feat | Front do prestador: serviços, disponibilidade e agenda do dia | US02, US03, US04, US08, RF03 a RF06, RF12 | 5 | G |
| 23 | chore | Seed com prestador e cliente de demonstração | RNF08 | 5 | P |
| 24 | chore | Deploy no Railway (API, worker, Postgres, RabbitMQ) e na Vercel (front) | — | 5 | M |
| 25 | docs | Medição de desempenho e README com GIF e diagrama | RNF01, RNF10 | 5 | M |

Total estimado: cerca de 24,5 dias de trabalho (1 dia = M), distribuídos em 5 ciclos: 5 no ciclo 1, 5 no 2, 5 no 3, 4,5 no 4 e 5 no 5.

## 7. Riscos do cronograma

| Risco | Resposta |
|---|---|
| Primeiro uso do RabbitMQ no NestJS | reservar meio dia de estudo (spike) no ciclo 4, antes da issue 18, com uma mensagem de teste de ponta a ponta |
| Constraint de exclusão e migração SQL escrita à mão | fazer um protótipo em banco local antes da issue 14 e já escrever o teste de concorrência (issue 16) em seguida |
| Erros com fuso horário e viradas de dia | cobrir com testes a função de horários livres e a agenda (reserva às 23h30, dia sem atendimento) antes de ligar ao front |
| Ciclo ficar cheio demais | o limite de 5 dias por ciclo vale: o que não couber vai para o ciclo seguinte; se o ciclo 5 estourar, cortar polimento visual e manter o fluxo completo de reservar e cancelar |
| Front tomar mais tempo que o previsto | começar o front no ciclo 3 (issue 13) e deixar as telas do prestador por último, com visual simples |
| Docker Compose diferente do ambiente de produção | usar as mesmas versões de Postgres e RabbitMQ no Compose e no Railway |

## 8. Rotina de cada ciclo

- **Início:** escolher as issues do ciclo no quadro e escrever a meta na milestone.
- **Durante:** puxar a próxima issue só quando a atual estiver pronta, respeitando o limite de 2 em andamento.
- **Fim:** revisão de 15 minutos com três perguntas (o que ficou pronto, o que não ficou e por quê, o que muda no próximo ciclo), registrada em `docs/ciclos.md`, e tag da versão.
