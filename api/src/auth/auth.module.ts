import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RefreshTokensService } from './refresh-tokens.service.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    UsersModule,
    // Limite usado no cadastro e no login: 10 tentativas por minuto por IP.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 10 }],
      errorMessage: 'Muitas tentativas. Espere um minuto e tente de novo.',
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: jwtSecret(config),
        // Token de acesso de 15 minutos (RN14, ADR 0004).
        signOptions: { expiresIn: '15m', algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokensService,
    // Guards globais, nesta ordem: primeiro quem é o usuário, depois o papel.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}

// Falha ao subir a API, e não no primeiro login, se o segredo faltar ou for fraco.
function jwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET') ?? '';
  if (secret.length < 32) {
    throw new Error('Defina JWT_SECRET no .env, com pelo menos 32 caracteres');
  }
  return secret;
}
