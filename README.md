# agendei

Agendamento de serviços sem horário duplicado. O prestador cadastra os serviços e os horários de atendimento, e o cliente escolhe um horário livre e reserva. Quem impede duas reservas no mesmo horário é o próprio banco, com uma constraint de exclusão do PostgreSQL.

> Em desenvolvimento. O andamento segue o [plano de ação](docs/03-plano-de-acao.md).

## Stack

- API em NestJS 12 e TypeScript em modo strict
- Swagger com a documentação da API
- Vitest e Supertest nos testes, oxlint e Prettier no código

O PostgreSQL, o RabbitMQ e o front em React chegam nos próximos ciclos, conforme a [arquitetura](docs/02-arquitetura.md).

## Como rodar

Pré-requisito: Node.js 22.

```bash
cd api
npm install
npm run start:dev
```

A API sobe em <http://localhost:3000>. A documentação fica em <http://localhost:3000/docs>.

## Scripts da API

Rodam dentro da pasta `api/`.

| Comando              | O que faz                                    |
| -------------------- | -------------------------------------------- |
| `npm run start:dev`  | sobe a API e reinicia a cada alteração       |
| `npm run build`      | gera o build em `dist/`                      |
| `npm run start:prod` | sobe o build                                 |
| `npm run lint`       | roda o oxlint                                |
| `npm run typecheck`  | confere os tipos com o TypeScript            |
| `npm run format`     | formata o código com o Prettier              |
| `npm test`           | roda os testes unitários                     |
| `npm run test:e2e`   | roda os testes das rotas HTTP                |

## Documentação

- [Levantamento de requisitos](docs/01-requisitos.md)
- [Arquitetura](docs/02-arquitetura.md)
- [Plano de ação](docs/03-plano-de-acao.md)
- [Decisões técnicas (ADRs)](docs/adr/)

## Licença

[MIT](LICENSE)
