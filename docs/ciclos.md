# Revisões de ciclo

Registro do fim de cada ciclo, com as três perguntas da [rotina do plano de ação](03-plano-de-acao.md#8-rotina-de-cada-ciclo).

## Ciclo 1: base, cadastro e login (`v0.1.0`)

- **Meta:** "Consigo criar conta, entrar e a base está no CI"
- **Revisão:** 20/11/2026
- **Resultado:** meta cumprida, issues 1 a 7 fechadas. O CI rodou verde no GitHub assim que o repositório foi publicado, no fim da revisão.

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

- **O CI só rodou no GitHub no fim do ciclo**, porque o repositório foi publicado na revisão. Durante as issues, a mesma sequência de comandos rodou localmente, a partir de um `npm ci` limpo.
- **As issues foram direto para a `main`, sem branch nem pull request**, pelo mesmo motivo: sem o repositório no GitHub, não havia onde abrir o PR.
- **O docker-compose só foi testado no fim do ciclo**, porque a máquina estava sem Docker. Durante as issues, as migrações e os testes rodaram num PostgreSQL em memória (PGlite). Na revisão, com o Docker instalado, a migração e todos os testes passaram no PostgreSQL 17, o painel do RabbitMQ respondeu e um e-mail de teste chegou ao Mailpit.
- **A RN02 está pela metade no banco.** O preço é um inteiro em centavos, mas o "maior ou igual a zero" ainda não é conferido. Entra na issue 8, junto com o cadastro de serviço.

Contratempos no caminho:

- O npm 10 trava ao gerar o `package-lock.json` do zero quando o Vitest fixado não é a versão mais nova. O lock foi gerado com o npm 11 e normalizado com o npm 10, e o `npm ci` passa nos dois.
- O `npm audit` apontou uma falha alta no pacote `effect`, que vem junto com o Prisma. Foi corrigida fixando a versão 3.22.4 em `overrides`.
- O primeiro push não disparou o CI. O último commit mexia só em documentação, que o CI ignora de propósito. O workflow ganhou o gatilho `workflow_dispatch`, que permite rodar à mão pela aba Actions.
- A revisão de segurança do fim do ciclo achou quatro pontos, todos corrigidos antes da tag:
  - a senha era limitada por caracteres, mas o bcrypt só lê os primeiros 72 bytes, e uma letra com acento ocupa 2;
  - duas abas renovando a sessão ao mesmo tempo derrubavam a pessoa, como se fosse roubo de token. Agora a troca acontece numa transação, e um reuso dentro de 10 segundos não encerra as sessões;
  - sem `WEB_URL`, a API subia com um endereço padrão e bloqueava o front sem avisar. Agora ela não sobe;
  - os testes de ponta a ponta apagam o banco e agora se recusam a rodar fora de um banco local.

  Um quinto ponto ficou como está: o cadastro avisa quando o e-mail já está em uso, como pede a US01. O limite de tentativas reduz o uso disso para descobrir contas.

### O que muda no próximo ciclo

- Com o repositório publicado, cada issue do ciclo 2 tem branch e pull request, e o merge só acontece com o CI verde.
- Rodar os testes no PostgreSQL do docker-compose, e não mais no PGlite. A issue 14 traz a constraint de exclusão, que depende da extensão `btree_gist`, e ela já está disponível na imagem.
- Anotado para o deploy (issue 24): ligar o `trust proxy` do Express, para o limite de tentativas enxergar o IP real atrás do proxy da hospedagem, e decidir o `SameSite` do cookie conforme os domínios do front e da API.

## Ciclo 2: serviços, disponibilidade e horários livres (`v0.2.0`)

- **Meta:** "O prestador cadastra serviços e horários, e o cliente vê os horários livres"
- **Revisão:** 20/11/2026
- **Resultado:** meta cumprida, issues 8 a 12 fechadas, cada uma num pull request mergeado com o CI verde.

### O que ficou pronto

- Serviços do prestador: criar, listar, editar e desativar. A duração é múltipla de 30 minutos, de 30 a 480 (RN01), e o preço é um inteiro de centavos (RN02). As duas regras também valem no banco, com `CHECK` numa migração escrita à mão (#8).
- Disponibilidade semanal: salvar substitui a semana inteira, e janelas sobrepostas no mesmo dia são recusadas sem mudar nada (RN03) (#9).
- O cliente lista os prestadores com os serviços ativos. Serviço desativado some da lista (RN10) (#10).
- Função pura de horários livres, testada sem banco e sem relógio, e conversão entre a hora local do prestador e UTC com o `@date-fns/tz`. O CI exige no mínimo 80% de cobertura dessas regras (RNF07), e hoje elas estão em 100% (#11).
- Rota `GET /providers/:id/slots`, que interpreta o dia e as janelas no fuso do prestador (RN13) e só conta as reservas confirmadas (RN06) (#12).
- No total, 24 testes unitários e 95 testes de ponta a ponta. Cada regra principal passou por um teste de mutação: com a regra quebrada de propósito, um teste falha.

### O que não ficou e por quê

- **As issues não estão no GitHub.** O Dependabot abriu dois PRs logo depois da publicação e ficou com os números 1 e 2. Criar as issues agora deixaria um "#8" do plano diferente do #8 do GitHub. As issues continuam no [plano de ação](03-plano-de-acao.md), e cada branch e pull request cita a issue do plano.
- **O tempo de resposta da rota de horários livres (RNF01) ainda não foi medido.** A medição está planejada para a issue 25.

Contratempos no caminho:

- O Dependabot sugeriu o TypeScript 7, que quebra o build, e os tipos do Node 26, num projeto que roda no Node 22. As versões maiores dos dois passaram a ser ignoradas.
- Um teste do horário de verão falhou porque usava como "agora" uma data posterior ao dia testado, e todos os horários pareciam passados. O erro era do teste, não da função.

### O que muda no próximo ciclo

- A constraint de exclusão da issue 14 entra numa migração escrita à mão, como os `CHECK` deste ciclo, e o teste de concorrência (issue 16) vem logo depois dela.
- O front começa na issue 13, e o CI ganha um job para ele.
- Decidir na issue 13 como o cookie de renovação chega à API em produção, com front e API em domínios diferentes. Com `SameSite=Strict`, o navegador não envia o cookie entre sites. A saída mais simples é a Vercel repassar `/api` para a API, deixando front e API no mesmo domínio.
