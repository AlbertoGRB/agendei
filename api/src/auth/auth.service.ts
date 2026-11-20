import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { AccessTokenPayload } from './auth-user.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

const BCRYPT_ROUNDS = 10;

// Hash de uma senha que ninguém usa. Quando o e-mail não existe, o login
// compara a senha com ele, para responder no mesmo tempo de um e-mail
// existente e não revelar quem tem conta.
const UNKNOWN_USER_HASH =
  '$2b$10$n0CrGH.rQFYXq/DjRsvR.OTbSqF/5wHJHTIbO54v/J2BHqFuM4bR.';

// O token de acesso vai no corpo da resposta; o de renovação, no cookie.
export type Session = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokensService,
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
      timezone: dto.timezone,
    });
  }

  async login(dto: LoginDto): Promise<Session> {
    const user = await this.users.findByEmail(dto.email);
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? UNKNOWN_USER_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    return {
      accessToken: await this.accessTokenFor(user),
      refreshToken: await this.refreshTokens.issue(user.id),
    };
  }

  async refresh(refreshToken: string | undefined): Promise<Session> {
    const rotated = refreshToken
      ? await this.refreshTokens.rotate(refreshToken)
      : null;
    const user = rotated ? await this.users.findById(rotated.userId) : null;
    if (!rotated || !user) {
      throw new UnauthorizedException('Sessão expirada. Entre de novo.');
    }

    return {
      accessToken: await this.accessTokenFor(user),
      refreshToken: rotated.newToken,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.refreshTokens.revoke(refreshToken);
    }
  }

  private accessTokenFor(user: User): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    return this.jwt.signAsync(payload);
  }
}
