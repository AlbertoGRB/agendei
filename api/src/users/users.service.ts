import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type Role, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type NewUser = {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  timezone?: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: NewUser): Promise<User> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      // P2002 é violação de chave única. Na tabela User, só o e-mail é único.
      // Conferir no banco, e não antes, evita duas contas com o mesmo e-mail
      // quando dois cadastros chegam ao mesmo tempo.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
