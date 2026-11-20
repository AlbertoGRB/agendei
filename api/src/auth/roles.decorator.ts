import { SetMetadata } from '@nestjs/common';
import type { Role } from '../generated/prisma/client.js';

export const ROLES_KEY = 'roles';

// Restringe a rota a um papel. Exemplo: @Roles('PROVIDER').
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
