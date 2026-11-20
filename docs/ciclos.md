# Revisões de ciclo

Registro do fim de cada ciclo, com as três perguntas da [rotina do plano de ação](03-plano-de-acao.md#8-rotina-de-cada-ciclo).

## Ciclo 1: base, cadastro e login (`v0.1.0`)

- **Meta:** "Consigo criar conta, entrar e a base está no CI"
- **Revisão:** 20/11/2026
- **Resultado:** meta cumprida em parte. As issues 1 a 7 foram entregues e já dá para criar conta e entrar, mas o CI só roda no GitHub depois que o repositório for publicado.

### O que ficou pronto

- NestJS 12 com TypeScript strict, oxlint, Prettier, Vitest e Swagger em `/docs` (#1).
- docker-compose com PostgreSQL 17, RabbitMQ e Mailpit, e o `.env.example` (#2).
- Schema do Prisma com as seis tabelas do modelo de dados e a primeira migração. As datas são gravadas com fuso (`timestamptz`) e o preço em centavos (#3).
- CI no GitHub Actions com um PostgreSQL de teste: lint, formatação, tipos, migrações, checagem de que o schema bate com as migrações, testes, build e `npm audit`. Dependabot mensal (#4).
- Cadastro e login com bcrypt. O token de acesso dura 15 minutos. E-mail errado e senha errada recebem a mesma mensagem, no mesmo tempo de resposta (#5).
- Renovação da sessão por um cookie `httpOnly`. O token é trocado a cada uso e o banco guarda só o hash. Um token já usado que volta encerra todas as sessões da pessoa (RN14) (#6).
- Acesso por papel (prestador ou cliente), com `403` para o papel errado. Limite de 10 tentativas por minuto no login e no cadastro, cabeçalhos de segurança com helmet e CORS liberado só para o front (#7).
- 37 testes de ponta a ponta, cobrindo os critérios de aceite das histórias, incluindo tokens adulterados, renovação em duas abas ao mesmo tempo e o limite de tentativas.

### O que não ficou e por quê

- **O CI ainda não rodou no GitHub**, porque o repositório ainda não foi publicado. A mesma sequência de comandos rodou localmente, a partir de um `npm ci` limpo.
- **As issues foram direto para a `main`, sem branch nem pull request**, pelo mesmo motivo: sem o repositório no GitHub, não havia onde abrir o PR.
- **O docker-compose só foi testado no fim do ciclo**, porque a máquina estava sem Docker. Durante as issues, as migrações e os testes rodaram num PostgreSQL em memória (PGlite). Na revisão, com o Docker instalado, a migração e todos os testes passaram no PostgreSQL 17, o painel do RabbitMQ respondeu e um e-mail de teste chegou ao Mailpit.
- **A RN02 está pela metade no banco.** O preço é um inteiro em centavos, mas o "maior ou igual a zero" ainda não é conferido. Entra na issue 8, junto com o cadastro de serviço.

Contratempos no caminho:

- O npm 10 trava ao gerar o `package-lock.json` do zero quando o Vitest fixado não é a versão mais nova. O lock foi gerado com o npm 11 e normalizado com o npm 10, e o `npm ci` passa nos dois.
- O `npm audit` apontou uma falha alta no pacote `effect`, que vem junto com o Prisma. Foi corrigida fixando a versão 3.22.4 em `overrides`.
- A revisão de segurança do fim do ciclo achou quatro pontos, todos corrigidos antes da tag:
  - a senha era limitada por caracteres, mas o bcrypt só lê os primeiros 72 bytes, e uma letra com acento ocupa 2;
  - duas abas renovando a sessão ao mesmo tempo derrubavam a pessoa, como se fosse roubo de token. Agora a troca acontece numa transação, e um reuso dentro de 10 segundos não encerra as sessões;
  - sem `WEB_URL`, a API subia com um endereço padrão e bloqueava o front sem avisar. Agora ela não sobe;
  - os testes de ponta a ponta apagam o banco e agora se recusam a rodar fora de um banco local.

  Um quinto ponto ficou como está: o cadastro avisa quando o e-mail já está em uso, como pede a US01. O limite de tentativas reduz o uso disso para descobrir contas.

### O que muda no próximo ciclo

- Publicar o repositório antes de começar o ciclo 2, para o CI rodar a cada push e cada issue ter branch e pull request.
- Rodar os testes no PostgreSQL do docker-compose, e não mais no PGlite. A issue 14 traz a constraint de exclusão, que depende da extensão `btree_gist`, e ela já está disponível na imagem.
- Anotado para o deploy (issue 24): ligar o `trust proxy` do Express, para o limite de tentativas enxergar o IP real atrás do proxy da hospedagem, e decidir o `SameSite` do cookie conforme os domínios do front e da API.
