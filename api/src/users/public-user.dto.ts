import { ApiProperty } from '@nestjs/swagger';
import { Role, type User } from '../generated/prisma/client.js';

// O que a API devolve sobre um usuário. Nunca inclui o hash da senha.
export class PublicUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Ana Souza' })
  name: string;

  @ApiProperty({ example: 'ana@exemplo.com' })
  email: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  timezone: string;
}

export function toPublicUser(user: User): PublicUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
  };
}
