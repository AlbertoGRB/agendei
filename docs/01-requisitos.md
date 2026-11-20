# Levantamento de requisitos: agendei

## 1. Problema

Quem atende com hora marcada (barbeiro, personal, consultório) costuma combinar horários por mensagem. Isso gera idas e vindas, esquecimento e, o pior caso, dois clientes marcados no mesmo horário. O cliente, por sua vez, quer ver o que está livre e reservar sem esperar resposta.

O agendei resolve isso: o prestador cadastra serviços e horários de atendimento, o cliente escolhe um horário livre e reserva. Dois clientes nunca conseguem o mesmo horário, e a confirmação chega por e-mail.

## 2. Público-alvo

| Perfil | Quem é | O que precisa |
|---|---|---|
| Prestador | profissional autônomo que atende com hora marcada | cadastrar serviços e horários uma vez, ver a agenda do dia e não ter horário duplicado |
| Cliente | quem quer marcar um atendimento | ver horários livres, reservar em poucos passos e cancelar se precisar |

## 3. Como os requisitos foram levantados

- **Análise de ferramentas parecidas**, para separar o que é básico em todas do que é diferencial:

| Ferramenta | O que oferece | O que serve de referência |
|---|---|---|
| Calendly | disponibilidade semanal e página de reserva por link | cadastro da disponibilidade por dia da semana e lista de horários livres |
| Booksy | agendamento de serviços de beleza, com catálogo de serviços | serviço com nome, duração e preço, e o fluxo do cliente (serviço, dia, horário) |
| SimplyBook.me | muitos recursos: pagamento, vários profissionais, lembretes, integrações | serve para decidir o que fica de fora do MVP |

- **Definição de escopo** para caber em 5 semanas de trabalho de uma pessoa. O núcleo é o que as três ferramentas têm em comum: serviços, disponibilidade, horários livres, reserva e cancelamento. Pagamento, lembretes, integração com agenda externa, vários profissionais e avaliações ficam para depois.

## 4. Requisitos funcionais

Prioridade pelo método MoSCoW: **Must** entra no MVP, **Should** entra se der tempo, **Could** fica para uma próxima versão, **Won't** está fora desta versão.

| ID | Requisito | Prioridade |
|---|---|---|
| RF01 | O usuário cria conta como prestador ou como cliente | Must |
| RF02 | O usuário entra, renova a sessão e sai | Must |
| RF03 | O prestador cadastra serviços com nome, duração e preço | Must |
| RF04 | O prestador edita e desativa seus serviços | Must |
| RF05 | O prestador define a disponibilidade da semana (por dia da semana, com uma ou mais janelas de horário) | Must |
| RF06 | O prestador vê a agenda do dia | Must |
| RF07 | O cliente lista os prestadores e os serviços ativos de cada um | Must |
| RF08 | O cliente escolhe prestador, serviço e dia e vê os horários livres | Must |
| RF09 | O cliente reserva um horário livre | Must |
| RF10 | O cliente vê suas reservas | Must |
| RF11 | O cliente cancela uma reserva até 2 horas antes do início | Must |
| RF12 | O prestador cancela uma reserva da sua agenda | Must |
| RF13 | O sistema bloqueia horário sobreposto para o mesmo prestador, mesmo quando duas reservas chegam no mesmo instante | Must |
| RF14 | O sistema envia e-mail de confirmação da reserva por uma fila | Must |
| RF15 | O sistema envia e-mail de cancelamento por uma fila | Must |
| RF16 | Pagamento antecipado com Pix (sandbox do Asaas) e webhook, com a reserva "aguardando pagamento" | Could |
| RF17 | Lembrete automático por e-mail 24 h antes | Could |
| RF18 | Reprocessar mensagens com erro por uma fila de mensagens mortas (DLQ) | Could |
| RF19 | Integração com o Google Agenda | Won't |
| RF20 | Mais de um profissional por estabelecimento | Won't |
| RF21 | Avaliações do atendimento | Won't |

## 5. Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF01 | Desempenho | `GET /providers/:id/slots` e `POST /bookings` respondem em menos de 300 ms (p95) com o banco local, medido e publicado no README |
| RNF02 | Consistência | Em um teste com várias reservas simultâneas para o mesmo horário, exatamente uma é aceita e as demais recebem `409` |
| RNF03 | Resiliência | O envio de e-mail não atrasa a resposta da reserva; se a fila estiver fora do ar, a reserva é gravada mesmo assim e o erro vai para o log |
| RNF04 | Segurança | Senha com bcrypt, validação de todos os dados de entrada, limite de requisições em login e cadastro e conferência do dono em toda rota |
| RNF05 | Usabilidade | Funcionar no celular; reservar em até 4 passos depois de escolher o prestador (serviço, dia, horário, confirmar) |
| RNF06 | Acessibilidade | Formulários e calendário navegáveis por teclado, com contraste nível AA |
| RNF07 | Manutenibilidade | TypeScript em modo strict, lint e testes no CI; função de horários livres e regras de reserva e cancelamento com mais de 80% de cobertura |
| RNF08 | Reprodutibilidade | Todo o ambiente (API, worker, Postgres, RabbitMQ e Mailpit) sobe com um comando de Docker Compose |
| RNF09 | Privacidade (LGPD) | O e-mail traz só o necessário: nome, serviço, data e hora |
| RNF10 | Documentação | O Swagger documenta todas as rotas da API |

## 6. Regras de negócio

| ID | Regra |
|---|---|
| RN01 | A duração do serviço é múltipla de 30 minutos, entre 30 e 480 |
| RN02 | O preço é guardado em centavos, como número inteiro maior ou igual a zero, para não haver erro de arredondamento |
| RN03 | A disponibilidade é uma lista de janelas por dia da semana (0 a 6), com início menor que o fim e sem janelas sobrepostas no mesmo dia. Salvar substitui a disponibilidade inteira da semana |
| RN04 | Os horários de início possíveis saem de 30 em 30 minutos dentro de uma janela, e o serviço precisa caber inteiro nela (intervalo de almoço e dia sem atendimento não geram horário) |
| RN05 | Horário que já passou não aparece como livre e não pode ser reservado |
| RN06 | Só reserva com status `CONFIRMED` ocupa o horário; ao cancelar, o horário volta a ficar livre |
| RN07 | Um prestador não tem duas reservas confirmadas que se sobreponham. A regra vale no banco, e o conflito devolve `409 Conflict` com a mensagem "esse horário acabou de ser reservado" |
| RN08 | O cliente cancela até 2 horas antes do início. Depois disso, o cancelamento é recusado. O prestador cancela qualquer reserva que ainda não começou |
| RN09 | Cada usuário só mexe no que é seu: o cliente vê e cancela só as próprias reservas, e o prestador altera só os próprios serviços, a própria disponibilidade e vê só a própria agenda |
| RN10 | Serviço desativado não aparece para novas reservas; as reservas já feitas continuam valendo |
| RN11 | O e-mail é único no sistema. O papel (prestador ou cliente) é escolhido no cadastro e não muda depois. Cliente não acessa rota de prestador, e vice-versa |
| RN12 | Cada reserva gera no máximo um e-mail de cada tipo (confirmação e cancelamento). Se a mesma mensagem chegar duas vezes à fila, o e-mail não sai em dobro |
| RN13 | Datas são gravadas em UTC. O dia e as janelas de atendimento são interpretados no fuso do prestador (padrão `America/Sao_Paulo`) |
| RN14 | O token de acesso dura 15 minutos. O de renovação é trocado a cada uso, e um token já usado ou revogado é recusado |

## 7. Histórias de usuário

### US01: Criar conta e entrar (RF01, RF02)

Como prestador ou cliente, quero criar uma conta e entrar, para usar o sistema com o meu perfil.

Critérios de aceite:
- Dado que informo nome, e-mail, senha e papel válidos, quando confirmo o cadastro, então a conta é criada e posso entrar.
- Dado que o e-mail já está em uso, quando confirmo, então vejo "e-mail já cadastrado" e nada é criado.
- Dado que estou logado e o token de acesso expirou, quando faço uma ação, então a sessão é renovada sem pedir a senha de novo.
- Dado que saio, quando tento renovar a sessão com o cookie antigo, então a renovação é recusada.
- Dado que sou cliente, quando chamo uma rota de prestador, então recebo `403`.

### US02: Cadastrar serviços (RF03, RF04)

Como prestador, quero cadastrar o que ofereço, com duração e preço, para o cliente escolher.

Critérios de aceite:
- Dado um serviço com nome, duração de 30 minutos e preço, quando salvo, então ele aparece na minha lista e para os clientes.
- Dado uma duração que não é múltipla de 30, quando salvo, então vejo o erro e nada é criado.
- Dado um serviço ativo, quando o desativo, então ele some para novas reservas e as reservas já feitas continuam.
- Dado o serviço de outro prestador, quando tento alterá-lo, então vejo 404.

### US03: Definir a disponibilidade (RF05)

Como prestador, quero informar em quais dias e horários atendo, para o cliente só ver horários em que posso atender.

Critérios de aceite:
- Dado que informo segunda a sexta, das 9h às 12h e das 14h às 18h, quando salvo, então esses são os únicos períodos oferecidos aos clientes.
- Dado que salvo uma nova disponibilidade, então a anterior é substituída por inteiro.
- Dado duas janelas que se sobrepõem no mesmo dia, quando salvo, então vejo o erro e nada muda.

### US04: Ver a agenda do dia (RF06)

Como prestador, quero ver as reservas do dia, para saber quem atender e quando.

Critérios de aceite:
- Dado um dia com reservas confirmadas, quando abro a agenda, então vejo cliente, serviço e horário, em ordem.
- Dado uma reserva cancelada, então ela não aparece como compromisso.
- Dado que o dia é interpretado no meu fuso, então uma reserva às 23h30 no horário de Brasília aparece no dia certo.

### US05: Achar um horário livre (RF07, RF08)

Como cliente, quero escolher prestador, serviço e dia e ver os horários livres, para reservar sem combinar por mensagem.

Critérios de aceite:
- Dado um prestador com disponibilidade e um serviço de 60 minutos, quando escolho o dia, então vejo horários de 30 em 30 minutos em que o serviço cabe inteiro na janela.
- Dado um horário já reservado, então ele e os que se sobreporiam a ele não aparecem.
- Dado um dia sem atendimento, então vejo "sem horários" e nenhuma lista.
- Dado o dia de hoje, então horários que já passaram não aparecem.

### US06: Reservar um horário (RF09, RF13, RF14)

Como cliente, quero reservar um horário livre, para garantir o atendimento.

Critérios de aceite:
- Dado um horário livre, quando confirmo, então a reserva é criada e recebo um e-mail de confirmação.
- Dado que outro cliente reservou o mesmo horário um instante antes, quando confirmo, então vejo "esse horário acabou de ser reservado" e escolho outro.
- Dado duas reservas para o mesmo horário enviadas ao mesmo tempo, então uma é aceita e a outra recebe `409`.
- Dado que a fila de e-mail está fora do ar, quando reservo, então a reserva é criada mesmo assim.

### US07: Ver e cancelar minhas reservas (RF10, RF11, RF15)

Como cliente, quero ver minhas reservas e cancelar se precisar, para liberar o horário.

Critérios de aceite:
- Dado que tenho reservas, quando abro "minhas reservas", então vejo só as minhas, com status.
- Dado uma reserva que começa em mais de 2 horas, quando cancelo, então ela é cancelada, o horário volta a ficar livre e recebo um e-mail de cancelamento.
- Dado uma reserva que começa em menos de 2 horas, quando tento cancelar, então o cancelamento é recusado com a explicação.
- Dado a reserva de outro cliente, quando tento cancelá-la, então vejo 404.

### US08: Cancelar uma reserva da minha agenda (RF12, RF15)

Como prestador, quero cancelar uma reserva quando tenho um imprevisto, para avisar o cliente.

Critérios de aceite:
- Dado uma reserva futura da minha agenda, quando cancelo, então o horário volta a ficar livre e o cliente recebe o e-mail de cancelamento.
- Dado a reserva de outro prestador, quando tento cancelar, então vejo 404.

## 8. Premissas e restrições

- Projeto de uma pessoa, com cerca de 5 semanas de trabalho.
- Um prestador por conta: não há conceito de estabelecimento com vários profissionais.
- Horários de início de 30 em 30 minutos, e durações múltiplas de 30.
- Sem pagamento no MVP: a reserva é confirmada na hora.
- E-mail como único canal de aviso. Em desenvolvimento, o Mailpit mostra os e-mails numa página local, sem enviar nada para fora.
- Dados de demonstração fictícios, com um prestador e um cliente de exemplo.

## 9. Riscos

| Risco | Impacto | Resposta |
|---|---|---|
| Duas reservas simultâneas para o mesmo horário | dois clientes no mesmo horário, perda de confiança no sistema | constraint de exclusão no banco ([ADR 0002](adr/0002-conflito-de-horario-no-banco.md)) e teste de concorrência no CI |
| Erro com fuso horário e horário de verão | horário mostrado errado ou reserva no dia errado | gravar em UTC e converter só na borda ([ADR 0005](adr/0005-datas-em-utc-com-fuso-do-prestador.md)), com testes nas viradas de dia |
| E-mail duplicado ou perdido por falha na fila | cliente recebe dois avisos ou nenhum | tabela de envio com chave única, até 3 tentativas e erro no log ([ADR 0003](adr/0003-notificacoes-por-fila-rabbitmq.md)) |
| Roubo do token de renovação | acesso indevido à conta | cookie `httpOnly`, rotação a cada uso e hash no banco ([ADR 0004](adr/0004-jwt-curto-e-refresh-em-cookie.md)) |
| Primeiro uso de RabbitMQ e da constraint de exclusão | atraso no cronograma | reservar tempo de estudo antes das issues da fila e da reserva |
