# ADR 0006: Front chama a API pelo próprio domínio, em `/api`

- **Situação:** aceita
- **Data:** 2026-11-21
- **Atualizada:** 2026-11-21, no deploy (issue 24): como a API acha o IP do cliente que chega pela Vercel
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
- Negativas: cada chamada passa pela Vercel antes de chegar no Railway, um salto a mais de latência, que entra na medição da issue 25. A API passa a receber a chamada da Vercel, então o limite de requisições por IP precisa achar o IP do cliente em outro lugar (veja a atualização abaixo). A renovação pelo Swagger, chamando a API direto, não leva o cookie, porque o caminho não bate; no Swagger vale o token de acesso no cabeçalho.

## Atualização: o IP do cliente atrás da Vercel (issue 24)

A primeira versão do deploy ligou o `trust proxy` do Express com 2 saltos, a Vercel e o Railway, para ler o IP do cliente no `X-Forwarded-For`. O teste em produção mostrou que não funciona. O proxy do Railway troca o `X-Forwarded-For` pelo IP que conectou nele, e pela Vercel esse IP é um de saída da Vercel, diferente a cada chamada. Com isso, o 11º login errado seguido passava, e o limite não segurava ninguém.

O que ficou:

- **A API confia no `x-vercel-forwarded-for` só com o segredo.** A Vercel grava o cabeçalho `x-origin-secret` em toda chamada repassada, com o valor de uma variável de ambiente (`transforms` no `web/vercel.json`), e troca o valor que o visitante mandar. Quando ele bate com o `ORIGIN_SECRET` da API, o limite conta o IP do `x-vercel-forwarded-for`.
- **Sem o segredo, conta o IP que chegou ao Railway**, lido com `trust proxy` de 1 salto. Quem chama o Railway direto é contado pelo próprio IP, porque o Railway troca o `X-Forwarded-For` que vier.
- **Alternativa descartada:** recusar toda chamada sem o segredo. Fecharia o domínio do Railway, mas também o Swagger em `/docs` e o `curl` direto na API, sem ganho para o limite, que já conta o IP certo nos dois caminhos.
