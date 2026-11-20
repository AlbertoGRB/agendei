import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export const REFRESH_TOKEN_DAYS = 7;

// O token é aleatório e longo, então SHA-256 basta (o bcrypt é para senhas,
// que são fáceis de adivinhar) e ainda permite achar o token pelo hash.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class RefreshTokensService {
  constructor(private readonly prisma: PrismaService) {}

  // Cria um token de renovação e devolve o valor. O banco guarda só o hash.
  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    });
    return token;
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

    // Revoga só se ainda não estava revogado. Se duas renovações chegam
    // juntas com o mesmo token, só uma consegue.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      // Token já usado voltou: pode ter sido copiado por outra pessoa.
      // Encerra todas as sessões do usuário, que precisa entrar de novo.
      await this.revokeAllForUser(stored.userId);
      return null;
    }

    return { userId: stored.userId, newToken: await this.issue(stored.userId) };
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
