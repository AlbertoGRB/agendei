import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export const REFRESH_TOKEN_DAYS = 7;

// Duas abas abertas pedem a renovação juntas ao carregar a página. Um token
// reaproveitado dentro desse intervalo não é tratado como roubo.
const REUSE_GRACE_MS = 10_000;

// O token é aleatório e longo, então SHA-256 basta (o bcrypt é para senhas,
// que são fáceis de adivinhar) e ainda permite achar o token pelo hash.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newToken(userId: string) {
  const value = randomBytes(32).toString('base64url');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  return { value, record: { userId, tokenHash: hashToken(value), expiresAt } };
}

@Injectable()
export class RefreshTokensService {
  constructor(private readonly prisma: PrismaService) {}

  // Cria um token de renovação e devolve o valor. O banco guarda só o hash.
  async issue(userId: string): Promise<string> {
    const token = newToken(userId);
    await this.prisma.refreshToken.create({ data: token.record });
    return token.value;
  }

  // Troca o token por um novo (rotação). Devolve null se o token não vale.
  async rotate(
    token: string,
  ): Promise<{ userId: string; newToken: string } | null> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored || stored.expiresAt <= new Date()) {
      return null;
    }

    // Revogar o antigo e criar o novo andam juntos: se um falhar, nada muda.
    const next = newToken(stored.userId);
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Revoga só se ainda não estava revogado. Se duas renovações chegam
      // juntas com o mesmo token, só uma consegue.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) {
        return false;
      }
      await tx.refreshToken.create({ data: next.record });
      return true;
    });
    if (rotated) {
      return { userId: stored.userId, newToken: next.value };
    }

    // Token já usado voltou depois do intervalo de tolerância: pode ter sido
    // copiado por outra pessoa. Encerra todas as sessões do usuário.
    const usedAt = stored.revokedAt ?? new Date();
    if (Date.now() - usedAt.getTime() > REUSE_GRACE_MS) {
      await this.revokeAllForUser(stored.userId);
    }
    return null;
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
