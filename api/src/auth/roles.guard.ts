import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/client.js';
import type { AuthUser } from './auth-user.js';
import { ROLES_KEY } from './roles.decorator.js';

// Roda depois do AuthGuard, que já colocou o usuário na requisição.
// Cliente não acessa rota de prestador, e vice-versa (RN11).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Seu perfil não tem acesso a esta rota');
    }
    return true;
  }
}
