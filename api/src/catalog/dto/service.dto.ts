import { ApiProperty } from '@nestjs/swagger';
import type { Service } from '../../generated/prisma/client.js';

export class ServiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Corte de cabelo' })
  name: string;

  @ApiProperty({ example: 60 })
  durationMinutes: number;

  @ApiProperty({ example: 5000, description: 'Em centavos' })
  priceCents: number;

  @ApiProperty()
  active: boolean;
}

export function toServiceDto(service: Service): ServiceDto {
  return {
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    priceCents: service.priceCents,
    active: service.active,
  };
}
