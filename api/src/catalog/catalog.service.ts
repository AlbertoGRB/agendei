import { Injectable, NotFoundException } from '@nestjs/common';
import type { Service } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateServiceDto } from './dto/create-service.dto.js';
import type { UpdateServiceDto } from './dto/update-service.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  create(providerId: string, data: CreateServiceDto): Promise<Service> {
    return this.prisma.service.create({ data: { ...data, providerId } });
  }

  // Serviços ativos, os únicos que o cliente vê e reserva (RN10). Sem o
  // prestador, traz os de todos.
  listActive(providerId?: string): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { active: true, providerId },
      orderBy: { name: 'asc' },
    });
  }

  findActive(providerId: string, id: string): Promise<Service | null> {
    return this.prisma.service.findFirst({
      where: { id, providerId, active: true },
    });
  }

  // Todos os serviços do prestador, inclusive os desativados.
  listByProvider(providerId: string): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { providerId },
      orderBy: { name: 'asc' },
    });
  }

  async update(
    providerId: string,
    id: string,
    data: UpdateServiceDto,
  ): Promise<Service> {
    // O dono entra no próprio WHERE: serviço de outro prestador não é
    // alterado e responde 404, como se não existisse (RN09).
    const { count } = await this.prisma.service.updateMany({
      where: { id, providerId },
      data,
    });
    if (count === 0) {
      throw new NotFoundException('Serviço não encontrado');
    }
    return this.prisma.service.findUniqueOrThrow({ where: { id } });
  }
}
