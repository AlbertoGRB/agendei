import type { Role } from '../generated/prisma/client.js';

// Quem está fazendo a requisição, lido do token de acesso.
export type AuthUser = {
  id: string;
  role: Role;
};

// Conteúdo do token de acesso (JWT).
export type AccessTokenPayload = {
  sub: string;
  role: Role;
};
