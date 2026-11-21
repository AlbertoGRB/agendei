import { ApiProperty, OmitType } from '@nestjs/swagger';
import type { Service, User } from '../../generated/prisma/client.js';
import { ServiceDto } from './service.dto.js';

// Para o cliente, todo serviço listado está ativo.
export class ProviderServiceDto extends OmitType(ServiceDto, ['active']) {}

// O que o cliente vê de um prestador: nome e serviços ativos, sem o e-mail.
export class ProviderDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Ana Souza' })
  name: string;

  @ApiProperty({ type: [ProviderServiceDto] })
  services: ProviderServiceDto[];
}

export function toProviderDto(
  provider: User,
  services: Service[],
): ProviderDto {
  return {
    id: provider.id,
    name: provider.name,
    services: services.map(({ id, name, durationMinutes, priceCents }) => ({
      id,
      name,
      durationMinutes,
      priceCents,
    })),
  };
}
