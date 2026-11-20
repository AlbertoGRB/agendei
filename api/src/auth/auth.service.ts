import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import type { AccessTokenPayload } from './auth-user.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const BCRYPT_ROUNDS = 10;

// Hash de uma senha que ninguém usa. Quando o e-mail não existe, o login
// compara a senha com ele, para responder no mesmo tempo de um e-mail
// existente e não revelar quem tem conta.
const UNKNOWN_USER_HASH =
  '$2b$10$n0CrGH.rQFYXq/DjRsvR.OTbSqF/5wHJHTIbO54v/J2BHqFuM4bR.';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
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

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.users.findByEmail(dto.email);
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? UNKNOWN_USER_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
