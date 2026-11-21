# ADR 0006: Front chama a API pelo próprio domínio, em `/api`

- **Situação:** aceita
- **Data:** 2026-11-21
- **Complementa:** [ADR 0004](0004-jwt-curto-e-refresh-em-cookie.md)

## Contexto

O token de renovação vai num cookie `SameSite=Strict` (ADR 0004). Com o front na Vercel e a API no Railway, os dois ficam em sites diferentes: `vercel.app` e `up.railway.app` estão na Public Suffix List, então cada app publicado nesses domínios é um site separado. O navegador não manda um cookie `Strict`, nem `Lax`, nas chamadas que o front faz para outro site. A saída seria `SameSite=None`, mas aí o cookie conta como de terceiros, e o Safari e o Firefox bloqueiam esse tipo de cookie por padrão. A sessão sumiria a cada recarga da página.

## Decisão

- O front chama a API no próprio domínio, com o prefixo `/api`. Em desenvolvimento, o proxy do Vite repassa `/api` para `http://localhost:3000`. Em produção, um rewrite da Vercel repassa para a API no Railway. Os dois tiram o prefixo antes de repassar.
- Para o navegador, as rotas de sessão ficam em `/api/auth`, então o cookie usa esse caminho.
- A API continua servindo as rotas sem prefixo, e o Swagger continua em `/docs`.

## Alternativas consideradas

- **`SameSite=None` com CORS:** o cookie vira de terceiros, e o Safari e o Firefox bloqueiam por padrão.
- **Domínio próprio, com o front e a API em subdomínios:** fica tudo no mesmo site e o `Strict` funciona, mas exige um domínio comprado. Vale se o projeto ganhar um.
- **Prefixo global `/api` na própria API:** o mesmo efeito para o navegador, mas muda todas as rotas, o Swagger e os testes, sem ganho.

## Consequências

- Positivas: o cookie continua `SameSite=Strict`; em produção, o navegador não faz chamada entre sites, então o CORS deixa de ser caminho da sessão; o endereço da API fica fora do código do front.
- Negativas: cada chamada passa pela Vercel antes de chegar no Railway, um salto a mais de latência, que entra na medição da issue 25. A API passa a receber a chamada da Vercel, então o limite de requisições por IP precisa ler o IP do cliente no cabeçalho `X-Forwarded-For`, com `trust proxy` (issue 24). A renovação pelo Swagger, chamando a API direto, não leva o cookie, porque o caminho não bate; no Swagger vale o token de acesso no cabeçalho.
