# ADR 0004: JWT de acesso curto e refresh em cookie

- **Situação:** aceita
- **Data:** 2026-11-19

## Contexto

O front é uma SPA em outro domínio que a API, e a API precisa ser usada também por outros clientes no futuro. O login precisa ser seguro, sem deixar um token de longa duração ao alcance de scripts da página (RNF04, RN14).

## Decisão

- **Token de acesso:** JWT de 15 minutos, enviado no cabeçalho `Authorization`, guardado só em memória no front.
- **Token de renovação (refresh):** valor aleatório entregue em cookie `httpOnly`, `Secure` e `SameSite`, que o JavaScript da página não consegue ler.
- O banco guarda só o hash do refresh (`RefreshToken.tokenHash`), nunca o valor.
- A cada `POST /auth/refresh`, o token usado é revogado e um novo é emitido (rotação). Token já usado, revogado ou expirado é recusado.
- O logout revoga o token no banco e limpa o cookie.
- Ao carregar a página, o front chama `/auth/refresh` para recuperar a sessão.

## Alternativas consideradas

- **Sessão em banco com cookie:** simples e fácil de revogar, mas cada requisição consulta o banco, e o cookie de sessão amarra a API a navegadores; atende mal outros clientes, como um app mobile.
- **JWT longo no `localStorage`:** o mais simples para o front, mas qualquer script injetado na página (XSS) lê o token, e um JWT longo não pode ser revogado antes de expirar.

## Consequências

- Positivas: o token de acesso curto limita o estrago se vazar; o refresh fora do alcance do JavaScript reduz o risco de XSS; a rotação e o hash no banco permitem revogar e detectar reuso.
- Negativas: mais código (emitir, trocar e revogar tokens); cookie entre domínios exige CORS com credenciais e `SameSite` bem configurados; a sessão some ao recarregar até a renovação terminar, e o front precisa tratar essa espera.
